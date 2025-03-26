import fetch from "node-fetch";

export class VoicevoxGenerator {
  private voicevoxUrl: string;

  constructor(voicevoxUrl: string = "http://localhost:50021") {
    console.log("VoicevoxGeneratorを初期化中...");
    this.voicevoxUrl = voicevoxUrl;
  }

  // 音声生成関数
  public async generateAudio(
    text: string,
    speaker: number
  ): Promise<ArrayBuffer> {
    console.log(`音声生成クエリを作成中: "${text}" (話者ID: ${speaker})`);

    // 音声合成用のクエリを作成
    const queryResponse = await fetch(
      `${this.voicevoxUrl}/audio_query?text=${encodeURIComponent(
        text
      )}&speaker=${speaker}`,
      {
        method: "POST",
      }
    );

    if (!queryResponse.ok) {
      throw new Error(
        `音声クエリの生成に失敗しました: ${queryResponse.status} ${queryResponse.statusText}`
      );
    }

    const query = await queryResponse.json();
    console.log("音声クエリの生成が完了しました");

    // 音声合成を実行
    console.log("音声合成を実行中...");
    const synthesisResponse = await fetch(
      `${this.voicevoxUrl}/synthesis?speaker=${speaker}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/wav",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(query),
      }
    );

    if (!synthesisResponse.ok) {
      throw new Error(
        `音声合成に失敗しました: ${synthesisResponse.status} ${synthesisResponse.statusText}`
      );
    }

    const audioData = await synthesisResponse.arrayBuffer();
    console.log("音声データの生成が完了しました");
    return audioData;
  }
}
