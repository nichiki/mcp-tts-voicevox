import { VoicevoxGenerator } from "./generator";
import { VoicevoxPlayer } from "./player";

interface VoicevoxConfig {
  url: string;
  defaultSpeaker?: number;
}

export class VoicevoxClient {
  private readonly player: VoicevoxPlayer;
  private readonly defaultSpeaker: number;
  private readonly maxSegmentLength: number = 150; // より長い区切りを許容

  constructor(config: VoicevoxConfig) {
    this.validateConfig(config);
    this.defaultSpeaker = config.defaultSpeaker ?? 1;
    this.player = new VoicevoxPlayer(config.url);
    console.log("VoicevoxClientを初期化しました");
  }

  /**
   * テキストを音声に変換して再生します
   * @param text 変換するテキスト
   * @param speaker 話者ID（オプション）
   * @returns 処理結果のメッセージ
   */
  public async speak(text: string, speaker?: number): Promise<string> {
    try {
      const speakerId = speaker ?? this.defaultSpeaker;
      const segments = this.splitText(text);

      for (const segment of segments) {
        console.log(
          `音声生成キューに追加: "${segment}" (話者ID: ${speakerId})`
        );
        await this.player.enqueue(segment, speakerId);
      }

      return `音声生成キューに追加しました: ${text}`;
    } catch (error) {
      console.error("音声生成中にエラーが発生しました:", error);
      throw new Error(
        `音声生成に失敗しました: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  /**
   * テキストを自然な区切りで分割します
   * @param text 分割するテキスト
   * @returns 分割されたテキストの配列
   */
  private splitText(text: string): string[] {
    // 文の区切りとなるパターン
    const sentenceEndings = /([。！？])/g;
    // 自然な区切りとなる接続詞や助詞
    const naturalBreaks =
      /([が、しかし、でも、けれど、そして、また、または、それで、だから、ですから、そのため、したがって、ゆえに、])/g;

    const segments: string[] = [];
    let currentSegment = "";

    // まず文末で分割
    const parts = text.split(sentenceEndings);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // 文末記号の場合は現在のセグメントに追加
      if (sentenceEndings.test(part)) {
        currentSegment += part;
        if (currentSegment.trim()) {
          segments.push(currentSegment.trim());
          currentSegment = "";
        }
        continue;
      }

      // 空の部分はスキップ
      if (!part.trim()) continue;

      // 自然な区切りで分割
      const subParts = part.split(naturalBreaks);

      for (let j = 0; j < subParts.length; j++) {
        const subPart = subParts[j];

        // 接続詞や助詞の場合は現在のセグメントに追加
        if (naturalBreaks.test(subPart)) {
          currentSegment += subPart;
          continue;
        }

        // 空の部分はスキップ
        if (!subPart.trim()) continue;

        // 現在のセグメントに追加
        currentSegment += subPart;

        // セグメントが最大長を超えた場合、または最後の部分の場合
        if (
          currentSegment.length >= this.maxSegmentLength ||
          (i === parts.length - 1 && j === subParts.length - 1)
        ) {
          if (currentSegment.trim()) {
            segments.push(currentSegment.trim());
          }
          currentSegment = "";
        }
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
