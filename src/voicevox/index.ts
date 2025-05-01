import { VoicevoxPlayer } from "./player";
import { AudioQuery, VoicevoxConfig } from "./types";
import { splitText } from "./utils";
import { handleError, formatError } from "./error";
import { VoicevoxApi } from "./api";

export class VoicevoxClient {
  private readonly player: VoicevoxPlayer;
  private readonly api: VoicevoxApi;
  private readonly defaultSpeaker: number;
  private readonly defaultSpeedScale: number;
  private readonly maxSegmentLength: number;

  constructor(config: VoicevoxConfig) {
    this.validateConfig(config);
    this.defaultSpeaker = config.defaultSpeaker ?? 1;
    this.defaultSpeedScale = config.defaultSpeedScale ?? 1.0;
    this.maxSegmentLength = 150;
    this.api = new VoicevoxApi(config.url);
    this.player = new VoicevoxPlayer(config.url);
  }

  /**
   * テキストを音声に変換して再生します
   * @param text 変換するテキストまたはテキストの配列
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 処理結果のメッセージ
   */
  public async speak(
    text: string | string[],
    speaker?: number,
    speedScale?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      const speed = this.getSpeedScale(speedScale);
      const queueManager = this.player.getQueueManager();

      // 文字列配列の場合は直接使用、文字列の場合は分割して配列に変換
      const segments = Array.isArray(text)
        ? text
        : splitText(text, this.maxSegmentLength);

      if (segments.length === 0) {
        return "テキストが空です";
      }

      // 最初のセグメントを優先的に処理して再生を早く開始
      if (segments.length > 0) {
        const firstQuery = await this.generateQuery(segments[0], speakerId);
        firstQuery.speedScale = speed;
        await queueManager.enqueueQuery(firstQuery, speakerId);
      }

      // 残りのセグメントは非同期で処理
      if (segments.length > 1) {
        // 残りのセグメントを非同期で処理する関数
        const processRemainingSegments = async () => {
          for (let i = 1; i < segments.length; i++) {
            const query = await this.generateQuery(segments[i], speakerId);
            query.speedScale = speed;
            await queueManager.enqueueQuery(query, speakerId);
          }
        };

        // 非同期で開始するが結果を待たない
        processRemainingSegments().catch((error) => {
          console.error("残りのセグメント処理中にエラーが発生しました:", error);
        });
      }

      return `音声生成キューに追加しました: ${
        Array.isArray(text) ? text.join(" ") : text
      }`;
    } catch (error) {
      return formatError("音声生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから音声合成用クエリを生成します
   * @param text 変換するテキスト
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 音声合成用クエリ
   */
  public async generateQuery(
    text: string,
    speaker?: number,
    speedScale?: number
  ): Promise<AudioQuery> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      // 直接APIを使用してクエリを生成
      const query = await this.api.generateQuery(text, speakerId);
      query.speedScale = this.getSpeedScale(speedScale);
      return query;
    } catch (error) {
      throw handleError("クエリ生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから直接音声ファイルを生成します
   * @param textOrQuery テキストまたは音声合成用クエリ
   * @param outputPath 出力ファイルパス（オプション、省略時は一時ファイル）
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 生成した音声ファイルのパス
   */
  public async generateAudioFile(
    textOrQuery: string | AudioQuery,
    outputPath?: string,
    speaker?: number,
    speedScale?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      const speed = this.getSpeedScale(speedScale);
      // キューマネージャーにアクセス
      const queueManager = this.player.getQueueManager();

      if (typeof textOrQuery === "string") {
        // テキストからクエリを生成
        const query = await this.generateQuery(textOrQuery, speakerId);
        query.speedScale = speed;

        // 直接APIで音声合成
        const audioData = await this.api.synthesize(query, speakerId);

        // 一時ファイル保存またはパス指定の保存
        if (!outputPath) {
          return await queueManager.saveTempAudioFile(audioData);
        } else {
          return await this.player.synthesizeToFile(
            query,
            outputPath,
            speakerId
          );
        }
      } else {
        // クエリを使って音声合成
        const query = { ...textOrQuery, speedScale: speed };
        const audioData = await this.api.synthesize(query, speakerId);

        // 一時ファイル保存またはパス指定の保存
        if (!outputPath) {
          return await queueManager.saveTempAudioFile(audioData);
        } else {
          return await this.player.synthesizeToFile(
            query,
            outputPath,
            speakerId
          );
        }
      }
    } catch (error) {
      throw handleError("音声ファイル生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストを音声ファイル生成キューに追加します
   * @param text テキスト
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 処理結果のメッセージ
   */
  public async enqueueAudioGeneration(
    text: string,
    speaker?: number,
    speedScale?: number
  ): Promise<string>;

  /**
   * 音声合成用クエリを音声ファイル生成キューに追加します
   * @param query 音声合成用クエリ
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 処理結果のメッセージ
   */
  public async enqueueAudioGeneration(
    query: AudioQuery,
    speaker?: number,
    speedScale?: number
  ): Promise<string>;

  // 実装
  public async enqueueAudioGeneration(
    textOrQuery: string | AudioQuery,
    speaker?: number,
    speedScale?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      const speed = this.getSpeedScale(speedScale);
      const queueManager = this.player.getQueueManager();

      if (typeof textOrQuery === "string") {
        // テキストの場合：分割して処理
        const segments = splitText(textOrQuery, this.maxSegmentLength);

        if (segments.length === 0) {
          return "テキストが空です";
        }

        // 最初のセグメントを優先処理
        if (segments.length > 0) {
          const firstQuery = await this.generateQuery(segments[0], speakerId);
          firstQuery.speedScale = speed;
          await queueManager.enqueueQuery(firstQuery, speakerId);
        }

        // 残りのセグメントは非同期で処理
        if (segments.length > 1) {
          // 非同期で処理する関数
          const processRemainingSegments = async () => {
            for (let i = 1; i < segments.length; i++) {
              const query = await this.generateQuery(segments[i], speakerId);
              query.speedScale = speed;
              await queueManager.enqueueQuery(query, speakerId);
            }
          };

          // 非同期で開始するが結果を待たない
          processRemainingSegments().catch((error) => {
            console.error(
              "残りのセグメント処理中にエラーが発生しました:",
              error
            );
          });
        }

        return `テキストをキューに追加しました: ${textOrQuery}`;
      } else {
        // クエリをキューに追加
        const query = { ...textOrQuery, speedScale: speed };
        await queueManager.enqueueQuery(query, speakerId);
        return "クエリをキューに追加しました";
      }
    } catch (error) {
      return formatError("音声生成中にエラーが発生しました", error);
    }
  }

  /**
   * 話者IDを取得（指定がない場合はデフォルト値を使用）
   * @private
   */
  private getSpeakerId(speaker?: number): number {
    return speaker ?? this.defaultSpeaker;
  }

  /**
   * 再生速度を取得（指定がない場合はデフォルト値を使用）
   * @private
   */
  private getSpeedScale(speedScale?: number): number {
    return speedScale ?? this.defaultSpeedScale;
  }

  private validateConfig(config: VoicevoxConfig): void {
    if (!config.url) {
      throw new Error("VOICEVOXのURLが指定されていません");
    }
    try {
      new URL(config.url);
    } catch {
      throw new Error("無効なVOICEVOXのURLです");
    }
  }

  /**
   * キューをクリア
   */
  public async clearQueue(): Promise<void> {
    return this.player.clearQueue();
  }
}

// 型定義の再エクスポート
export * from "./types";
