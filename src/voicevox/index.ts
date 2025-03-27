import { VoicevoxPlayer } from "./player";

// 共通の型定義
export interface AudioQuery {
  [key: string]: any;
}

interface VoicevoxConfig {
  url: string;
  defaultSpeaker?: number;
  maxSegmentLength?: number;
}

export class VoicevoxClient {
  private readonly player: VoicevoxPlayer;
  private readonly defaultSpeaker: number;
  private readonly maxSegmentLength: number;

  constructor(config: VoicevoxConfig) {
    this.validateConfig(config);
    this.defaultSpeaker = config.defaultSpeaker ?? 1;
    this.maxSegmentLength = config.maxSegmentLength ?? 150;
    this.player = new VoicevoxPlayer(config.url);
  }

  /**
   * テキストを音声に変換して再生します
   * @param text 変換するテキスト
   * @param speaker 話者ID（オプション）
   * @returns 処理結果のメッセージ
   */
  public async speak(text: string, speaker?: number): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      const segments = this.splitText(text);

      for (const segment of segments) {
        await this.player.enqueue(segment, speakerId);
      }

      return `音声生成キューに追加しました: ${text}`;
    } catch (error) {
      return this.handleError("音声生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから音声合成用クエリを生成します
   * @param text 変換するテキスト
   * @param speaker 話者ID（オプション）
   * @returns 音声合成用クエリ
   */
  public async generateQuery(
    text: string,
    speaker?: number
  ): Promise<AudioQuery> {
    try {
      const speakerId = this.getSpeakerId(speaker);
      return await this.player.generateQuery(text, speakerId);
    } catch (error) {
      throw this.handleError("クエリ生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストから直接音声ファイルを生成します
   * @param textOrQuery テキストまたは音声合成用クエリ
   * @param outputPath 出力ファイルパス（オプション、省略時は一時ファイル）
   * @param speaker 話者ID（オプション）
   * @returns 生成した音声ファイルのパス
   */
  public async generateAudioFile(
    textOrQuery: string | AudioQuery,
    outputPath?: string,
    speaker?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);

      // テキストかクエリかを判断
      if (typeof textOrQuery === "string") {
        // テキストの場合は分割せずに直接クエリを生成
        const query = await this.generateQuery(textOrQuery, speakerId);
        return await this.player.synthesizeToFile(
          query,
          outputPath ?? "",
          speakerId
        );
      } else {
        // クエリの場合はそのまま音声ファイルを生成
        return await this.player.synthesizeToFile(
          textOrQuery,
          outputPath ?? "",
          speakerId
        );
      }
    } catch (error) {
      throw this.handleError("音声ファイル生成中にエラーが発生しました", error);
    }
  }

  /**
   * テキストを音声ファイル生成キューに追加します
   * @param text テキスト
   * @param speaker 話者ID（オプション）
   * @returns 処理結果のメッセージ
   */
  public async enqueueAudioGeneration(
    text: string,
    speaker?: number
  ): Promise<string>;

  /**
   * 音声合成用クエリを音声ファイル生成キューに追加します
   * @param query 音声合成用クエリ
   * @param speaker 話者ID（オプション）
   * @returns 処理結果のメッセージ
   */
  public async enqueueAudioGeneration(
    query: AudioQuery,
    speaker?: number
  ): Promise<string>;

  // 実装
  public async enqueueAudioGeneration(
    textOrQuery: string | AudioQuery,
    speaker?: number
  ): Promise<string> {
    try {
      const speakerId = this.getSpeakerId(speaker);

      if (typeof textOrQuery === "string") {
        // テキストの場合
        return await this.speak(textOrQuery, speakerId);
      } else {
        // クエリの場合
        await this.player.enqueueWithQuery(textOrQuery, speakerId);
        return "クエリをキューに追加しました";
      }
    } catch (error) {
      return this.handleError("音声生成中にエラーが発生しました", error);
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
   * エラーハンドリング
   * @private
   */
  private handleError(message: string, error: unknown): never {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${message}: ${errorMsg}`, error);
    throw new Error(`${message}: ${errorMsg}`);
  }

  /**
   * テキストを自然な区切りで分割します
   * @param text 分割するテキスト
   * @returns 分割されたテキストの配列
   */
  private splitText(text: string): string[] {
    // 文の区切りとなるパターン
    const sentenceEndings = /([。！？])/;
    // 自然な区切りとなる接続詞や助詞
    const naturalBreaks =
      /([、しかし、でも、けれど、そして、また、または、それで、だから、ですから、そのため、したがって、ゆえに])/;

    const segments: string[] = [];
    let currentSegment = "";

    // 文を句読点で分割
    const sentences = text
      .split(sentenceEndings)
      .reduce((acc, part, i, arr) => {
        if (i % 2 === 0) {
          // テキスト部分
          acc.push(part);
        } else {
          // 句読点部分 - 前のテキストと結合
          acc[acc.length - 1] += part;
        }
        return acc;
      }, [] as string[]);

    // 文ごとに処理
    for (const sentence of sentences) {
      if (!sentence.trim()) continue;

      // 現在のセグメントに追加してみる
      const potentialSegment = currentSegment + sentence;

      // 最大長を超えないならそのまま追加
      if (potentialSegment.length <= this.maxSegmentLength) {
        currentSegment = potentialSegment;
      } else {
        // 最大長を超える場合、naturalBreaksで分割を試みる
        const parts = sentence.split(naturalBreaks);

        // 分割パーツを処理
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part.trim()) continue;

          // 現在のセグメントに追加してみる
          const newSegment = currentSegment + part;

          // 最大長を超えるかチェック
          if (newSegment.length <= this.maxSegmentLength) {
            currentSegment = newSegment;
          } else {
            // 既存のセグメントがあれば保存
            if (currentSegment.trim()) {
              segments.push(currentSegment.trim());
            }
            currentSegment = part;
          }
        }
      }

      // 一文が終わったら保存判定
      if (
        currentSegment.length >= this.maxSegmentLength &&
        currentSegment.trim()
      ) {
        segments.push(currentSegment.trim());
        currentSegment = "";
      }
    }

    // 残りのテキストがあれば追加
    if (currentSegment.trim()) {
      segments.push(currentSegment.trim());
    }

    return segments;
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
