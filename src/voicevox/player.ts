import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import axios, { AxiosResponse, AxiosRequestConfig } from "axios";
import { AudioQuery } from "./index";

const sound = require("sound-play");

interface QueueItem {
  text: string;
  speaker: number;
  audioData?: ArrayBuffer;
  tempFile?: string;
  query?: AudioQuery;
}

interface VoicevoxError extends Error {
  statusCode?: number;
  response?: any;
}

export class VoicevoxPlayer {
  private voicevoxUrl: string;
  private queue: QueueItem[] = [];
  private isPlaying: boolean = false;
  private isGenerating: boolean = false;
  private prefetchSize: number = 2; // プリフェッチするアイテム数

  constructor(voicevoxUrl: string = "http://localhost:50021") {
    this.voicevoxUrl = this.normalizeUrl(voicevoxUrl);
  }

  /**
   * テキストをキューに追加
   */
  public async enqueue(text: string, speaker: number = 1): Promise<void> {
    try {
      const item = { text, speaker };
      this.queue.push(item);
      await this.generateAudio(item); // 音声データの生成を待つ
      this.prefetchAudio(); // 次の音声の事前生成を開始
      this.processQueue(); // 再生キューの処理を開始
    } catch (error) {
      this.handleError("キューへの追加中にエラーが発生しました", error);
    }
  }

  /**
   * クエリを使ってキューに追加
   */
  public async enqueueWithQuery(
    query: AudioQuery,
    speaker: number = 1
  ): Promise<void> {
    try {
      const item = { text: "クエリから生成", speaker, query };
      this.queue.push(item);
      await this.generateAudioFromQuery(item); // 音声データの生成を待つ
      this.prefetchAudio(); // 次の音声の事前生成を開始
      this.processQueue(); // 再生キューの処理を開始
    } catch (error) {
      this.handleError("クエリからの音声生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから音声合成用クエリを生成
   */
  public async generateQuery(
    text: string,
    speaker: number = 1
  ): Promise<AudioQuery> {
    try {
      const endpoint = `/audio_query?text=${encodeURIComponent(
        text
      )}&speaker=${speaker}`;
      return await this.makeRequest<AudioQuery>("post", endpoint, null, {
        "Content-Type": "application/json",
      });
    } catch (error) {
      throw this.handleError("音声クエリ生成中にエラーが発生しました", error);
    }
  }

  /**
   * 音声合成用クエリから音声ファイルを生成
   */
  public async synthesizeToFile(
    query: AudioQuery,
    output: string,
    speaker: number = 1
  ): Promise<string> {
    try {
      // 音声を合成
      const audioData = await this.makeRequest<ArrayBuffer>(
        "post",
        `/synthesis?speaker=${speaker}`,
        query,
        {
          "Content-Type": "application/json",
          Accept: "audio/wav",
        },
        "arraybuffer"
      );

      // 出力パスが指定されていなければ一時ファイルを作成
      const filePath = output || this.createTempFilePath();
      await writeFile(filePath, Buffer.from(audioData));

      return filePath;
    } catch (error) {
      throw this.handleError("音声ファイル生成中にエラーが発生しました", error);
    }
  }

  /**
   * キューをクリア
   */
  public clearQueue(): void {
    // 一時ファイルの削除処理を追加
    this.queue.forEach((item) => {
      if (item.tempFile) {
        this.deleteTempFile(item.tempFile).catch(console.error);
      }
    });
    this.queue = [];
  }

  /**
   * APIリクエストを実行
   * @private
   */
  private async makeRequest<T>(
    method: "get" | "post",
    endpoint: string,
    data: any = null,
    headers: Record<string, string> = {},
    responseType: "json" | "arraybuffer" = "json"
  ): Promise<T> {
    try {
      const url = `${this.voicevoxUrl}${endpoint}`;
      const config: AxiosRequestConfig = {
        method,
        url,
        data,
        headers,
        responseType,
        timeout: 30000, // 30秒タイムアウト
      };

      const response = await axios(config);

      if (response.status !== 200) {
        const error = new Error(
          `APIリクエストに失敗しました: ${response.status}`
        ) as VoicevoxError;
        error.statusCode = response.status;
        error.response = response.data;
        throw error;
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const voicevoxError = new Error(
          `APIリクエストに失敗しました: ${error.message}`
        ) as VoicevoxError;
        voicevoxError.statusCode = error.response?.status;
        voicevoxError.response = error.response?.data;
        throw voicevoxError;
      }
      throw error;
    }
  }

  /**
   * エラーハンドリング
   * @private
   */
  private handleError(message: string, error: unknown): never {
    const errorDetails = error instanceof Error ? error.message : String(error);
    console.error(`${message}: ${errorDetails}`, error);
    throw new Error(`${message}: ${errorDetails}`);
  }

  /**
   * 音声の事前生成
   * @private
   */
  private async prefetchAudio(): Promise<void> {
    if (this.isGenerating) return;

    this.isGenerating = true;
    try {
      // プリフェッチサイズまでの音声を生成
      const itemsToGenerate = this.queue
        .filter((item) => !item.audioData)
        .slice(0, this.prefetchSize);

      if (itemsToGenerate.length === 0) {
        return;
      }

      await Promise.all(
        itemsToGenerate.map((item) =>
          item.query
            ? this.generateAudioFromQuery(item)
            : this.generateAudio(item)
        )
      );
    } catch (error) {
      console.error("音声の事前生成中にエラーが発生しました:", error);
    } finally {
      this.isGenerating = false;
    }
  }

  /**
   * クエリから音声生成処理
   * @private
   */
  private async generateAudioFromQuery(item: QueueItem): Promise<void> {
    try {
      if (!item.query) {
        throw new Error("音声合成用クエリが指定されていません");
      }

      // 音声を合成
      const audioData = await this.makeRequest<ArrayBuffer>(
        "post",
        `/synthesis?speaker=${item.speaker}`,
        item.query,
        {
          "Content-Type": "application/json",
          Accept: "audio/wav",
        },
        "arraybuffer"
      );

      // 音声データを保存
      item.audioData = audioData;

      // 一時ファイルに保存
      if (item.audioData) {
        const tempFile = this.createTempFilePath();
        await writeFile(tempFile, Buffer.from(item.audioData));
        item.tempFile = tempFile;
      }
    } catch (error) {
      console.error("音声生成中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * 音声生成処理
   * @private
   */
  private async generateAudio(item: QueueItem): Promise<void> {
    try {
      // 音声クエリを生成
      const query = await this.generateQuery(item.text, item.speaker);
      item.query = query;

      // クエリから音声を生成
      await this.generateAudioFromQuery(item);
    } catch (error) {
      console.error("音声生成中にエラーが発生しました:", error);
      throw error;
    }
  }

  /**
   * キュー処理
   * @private
   */
  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];

        // 音声データが生成されるまで待機
        if (!item.tempFile) {
          await this.waitForAudio(item);
        }

        if (item.tempFile) {
          // 音声再生
          await this.playAudio(item.tempFile);

          // 再生後にキューから削除
          this.queue.shift();

          // 一時ファイルを削除
          await this.deleteTempFile(item.tempFile);
        } else {
          // 音声生成に失敗した場合はスキップ
          console.error("音声生成に失敗したためスキップします");
          this.queue.shift();
        }

        // 次の音声のプリフェッチを開始
        this.prefetchAudio();
      }
    } catch (error) {
      console.error("音声再生中にエラーが発生しました:", error);
    } finally {
      this.isPlaying = false;
    }
  }

  /**
   * 音声再生
   * @private
   */
  private async playAudio(filePath: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        sound
          .play(filePath)
          .then(() => {
            resolve();
          })
          .catch((error: Error) => {
            console.error("音声再生中にエラーが発生しました:", error);
            reject(error);
          });
      } catch (error) {
        console.error("音声再生中にエラーが発生しました:", error);
        reject(error);
      }
    });
  }

  /**
   * 音声データが生成されるまで待機
   * @private
   */
  private async waitForAudio(item: QueueItem): Promise<void> {
    let retryCount = 0;
    const maxRetry = 10;
    const retryInterval = 500; // ms

    return new Promise<void>((resolve, reject) => {
      const checkAudio = () => {
        if (item.tempFile) {
          resolve();
          return;
        }

        if (retryCount >= maxRetry) {
          reject(new Error("音声データの生成がタイムアウトしました"));
          return;
        }

        retryCount++;
        setTimeout(checkAudio, retryInterval);
      };

      checkAudio();
    });
  }

  /**
   * 一時ファイルパスの生成
   * @private
   */
  private createTempFilePath(): string {
    return join(
      tmpdir(),
      `voicevox-${Date.now()}-${Math.random().toString(36).substring(2, 9)}.wav`
    );
  }

  /**
   * 一時ファイルの削除
   * @private
   */
  private async deleteTempFile(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      console.error("一時ファイルの削除に失敗しました:", error);
    }
  }

  /**
   * URLの正規化
   * @private
   */
  private normalizeUrl(url: string): string {
    // 末尾のスラッシュを削除
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }
}
