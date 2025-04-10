import { VoicevoxPlayer } from "./player";
import { AudioQuery, VoicevoxConfig } from "./types";
import { splitText } from "./utils";
import { handleError, formatError } from "./error";

export class VoicevoxClient {
  private readonly player: VoicevoxPlayer;
  private readonly defaultSpeaker: number;
  private readonly defaultSpeedScale: number;
  private readonly maxSegmentLength: number;

  constructor(config: VoicevoxConfig) {
    this.validateConfig(config);
    this.defaultSpeaker = config.defaultSpeaker ?? 1;
    this.defaultSpeedScale = config.defaultSpeedScale ?? 1.0;
    this.maxSegmentLength = 150;
    this.player = new VoicevoxPlayer(config.url);
  }

  /**
   * テキストを音声に変換して再生します
   * @param text 変換するテキスト
   * @param speaker 話者ID（オプション）
   * @param speedScale 再生速度（オプション）
   * @returns 処理結果のメッセージ
   */
  public async speak(
    text: string,
    speaker?: number,
    speedScale?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      const speed = this.getSpeedScale(speedScale);
      const segments = splitText(text, this.maxSegmentLength);

      for (const segment of segments) {
        const query = await this.player.generateQuery(segment, speakerId);
        query.speedScale = speed;
        await this.player.enqueueWithQuery(query, speakerId);
      }

      return `音声生成キューに追加しました: ${text}`;
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
      const query = await this.player.generateQuery(text, speakerId);
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

      if (typeof textOrQuery === "string") {
        const query = await this.generateQuery(textOrQuery, speakerId);
        query.speedScale = speed;
        return await this.player.synthesizeToFile(query, outputPath, speakerId);
      } else {
        const query = { ...textOrQuery, speedScale: speed };
        return await this.player.synthesizeToFile(query, outputPath, speakerId);
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

      if (typeof textOrQuery === "string") {
        return await this.speak(textOrQuery, speakerId, speed);
      } else {
        const query = { ...textOrQuery, speedScale: speed };
        await this.player.enqueueWithQuery(query, speakerId);
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
}

// 型定義の再エクスポート
export * from "./types";
