import fetch from "node-fetch";

export class VoicevoxGenerator {
  private voicevoxUrl: string;

  constructor(voicevoxUrl: string = "http://localhost:50021") {
    this.voicevoxUrl = voicevoxUrl;
  }

  // 音声生成関数
  public async generateAudio(
    text: string,
    speaker: number
  ): Promise<ArrayBuffer> {
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

    // 音声合成を実行
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
    return audioData;
  }
}
