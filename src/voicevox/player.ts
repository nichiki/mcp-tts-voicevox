import { AudioQuery } from "./types";
import { VoicevoxQueueManager, QueueEventType, QueueItemStatus } from "./queue";
import { handleError } from "./error";
import { VoicevoxApi } from "./api";
import * as fsPromises from "fs/promises";
import { dirname, join, extname, isAbsolute } from "path";
import { stat } from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { tmpdir } from "os";

/**
 * VOICEVOX音声プレイヤークラス
 * キュー管理システムを使用して音声の合成と再生を行う
 */
export class VoicevoxPlayer {
  private queueManager: VoicevoxQueueManager;
  private api: VoicevoxApi; // APIインスタンスを保持

  /**
   * コンストラクタ
   * @param voicevoxUrl VOICEVOX Engine API URL
   * @param prefetchSize 事前生成するアイテム数
   */
  constructor(
    voicevoxUrl: string = "http://localhost:50021",
    prefetchSize: number = 2
  ) {
    // APIインスタンスを作成
    this.api = new VoicevoxApi(voicevoxUrl);
    // キューマネージャーにAPIインスタンスを注入
    this.queueManager = new VoicevoxQueueManager(this.api, prefetchSize);

    // デフォルトで再生を開始
    this.queueManager.startPlayback();

    // エラーイベントのログ記録
    this.queueManager.addEventListener(QueueEventType.ERROR, (_, item) => {
      if (item) {
        console.error(
          `音声合成エラー: ${item.text} (${
            item.error?.message || "不明なエラー"
          })`
        );
      }
    });
  }

  /**
   * テキストをキューに追加
   * @param text 合成するテキスト
   * @param speaker 話者ID
   */
  public async enqueue(text: string, speaker: number = 1): Promise<void> {
    try {
      await this.queueManager.enqueueText(text, speaker);
    } catch (error) {
      handleError("キューへの追加中にエラーが発生しました", error);
    }
  }

  /**
   * クエリを使ってキューに追加
   * @param query 音声合成用クエリ
   * @param speaker 話者ID
   */
  public async enqueueWithQuery(
    query: AudioQuery,
    speaker: number = 1
  ): Promise<void> {
    try {
      await this.queueManager.enqueueQuery(query, speaker);
    } catch (error) {
      handleError("クエリからの音声生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから音声合成用クエリを生成
   * @param text 合成するテキスト
   * @param speaker 話者ID
   */
  public async generateQuery(
    text: string,
    speaker: number = 1
  ): Promise<AudioQuery> {
    try {
      // 一時的にキューにテキストを追加してクエリを取得
      const item = await this.queueManager.enqueueText(text, speaker);

      // クエリが生成されるまで待機
      const maxRetries = 40;
      const retryInterval = 500;
      let retryCount = 0;

      return await new Promise<AudioQuery>((resolve, reject) => {
        const checkQuery = () => {
          const status = this.queueManager.getItemStatus(item.id);
          const currentItem = this.queueManager
            .getQueue()
            .find((i) => i.id === item.id);

          if (currentItem?.query) {
            // クエリが取得できたらキューから削除して返す
            const query = { ...currentItem.query };
            this.queueManager.removeItem(item.id);
            resolve(query);
            return;
          }

          if (status === QueueItemStatus.ERROR) {
            this.queueManager.removeItem(item.id);
            reject(new Error("クエリの生成に失敗しました"));
            return;
          }

          if (retryCount >= maxRetries) {
            this.queueManager.removeItem(item.id);
            reject(new Error("クエリの生成がタイムアウトしました"));
            return;
          }

          retryCount++;
          setTimeout(checkQuery, retryInterval);
        };

        checkQuery();
      });
    } catch (error) {
      throw handleError("音声クエリ生成中にエラーが発生しました", error);
    }
  }

  /**
   * 音声合成用クエリから音声ファイルを生成
   * @param query 音声合成用クエリ
   * @param output 出力ファイルパスまたは出力ディレクトリ（省略時は一時ディレクトリに生成）
   * @param speaker 話者ID
   */
  public async synthesizeToFile(
    query: AudioQuery,
    output?: string,
    speaker: number = 1
  ): Promise<string> {
    try {
      // クエリから直接音声を合成（キューを使わない）
      const audioData = await this.api.synthesize(query, speaker);

      // outputが未定義または空文字列の場合は、一時ディレクトリにファイルを作成
      if (!output) {
        const tempFilePath = this.createTempFilePath();
        await fsPromises.writeFile(tempFilePath, Buffer.from(audioData));
        return tempFilePath;
      }

      // 出力が実際にディレクトリかファイルパスか判断
      let targetPath = output;
      let isDir = false;

      try {
        const outputStat = await stat(output);
        isDir = outputStat.isDirectory();
      } catch (err) {
        // ファイルまたはディレクトリが存在しない場合
        // 末尾がスラッシュで終わる場合はディレクトリと見なす
        isDir = output.endsWith("/") || output.endsWith("\\");
      }

      // ディレクトリの場合、ファイル名を生成
      if (isDir) {
        const filename = `voice-${uuidv4()}.wav`;
        targetPath = join(output, filename);
      }

      // 出力ディレクトリが存在するか確認し、存在しない場合は作成
      await fsPromises.mkdir(dirname(targetPath), { recursive: true });

      // 音声データを指定された出力先に書き込み
      await fsPromises.writeFile(targetPath, Buffer.from(audioData));

      return targetPath;
    } catch (error) {
      throw handleError("音声ファイル生成中にエラーが発生しました", error);
    }
  }

  /**
   * 一時ファイルのパスを生成
   * @returns 一時ファイルのパス
   */
  private createTempFilePath(): string {
    const uniqueFilename = `voicevox-${uuidv4()}.wav`;
    return join(tmpdir(), uniqueFilename);
  }

  /**
   * キューをクリア
   */
  public clearQueue(): void {
    this.queueManager.clearQueue();
  }

  /**
   * 再生を一時停止
   */
  public pausePlayback(): Promise<void> {
    return this.queueManager.pausePlayback();
  }

  /**
   * 再生を再開
   */
  public resumePlayback(): Promise<void> {
    return this.queueManager.resumePlayback();
  }

  /**
   * キュー内のアイテム数を取得
   */
  public getQueueLength(): number {
    return this.queueManager.getQueue().length;
  }

  /**
   * イベントリスナーを追加
   * キュー管理システムからのイベントを監視できるようにする
   */
  public addEventListener(
    event: QueueEventType,
    listener: (event: QueueEventType, item?: any) => void
  ): void {
    this.queueManager.addEventListener(event, listener);
  }

  /**
   * イベントリスナーを削除
   */
  public removeEventListener(
    event: QueueEventType,
    listener: (event: QueueEventType, item?: any) => void
  ): void {
    this.queueManager.removeEventListener(event, listener);
  }
}
