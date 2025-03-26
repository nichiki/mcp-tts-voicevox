import fetch from "node-fetch";

export class VoicevoxClient {
  private voicevoxUrl: string;

  constructor(voicevoxUrl: string = "http://localhost:50021") {
    console.log("VoicevoxClientを初期化中...");
    this.voicevoxUrl = voicevoxUrl;
  }

  public async generateAudioQuery(
    text: string,
    speaker: number = 1
  ): Promise<any> {
    console.log(`音声クエリを生成中... テキスト: "${text}", 話者: ${speaker}`);

    try {
      const response = await fetch(
        `${this.voicevoxUrl}/audio_query?text=${encodeURIComponent(
          text
        )}&speaker=${speaker}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(
          `音声クエリの生成に失敗しました: ${response.status} ${response.statusText}`
        );
      }

      const query = await response.json();
      console.log("音声クエリの生成が完了しました");
      return query;
    } catch (error) {
      console.error("音声クエリの生成中にエラーが発生しました:", error);
      throw error;
    }
  }

  public async synthesize(
    query: any,
    speaker: number = 1
  ): Promise<ArrayBuffer> {
    console.log(`音声を合成中... 話者: ${speaker}`);

    try {
      const response = await fetch(
        `${this.voicevoxUrl}/synthesis?speaker=${speaker}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/wav",
          },
          body: JSON.stringify(query),
        }
      );

      if (!response.ok) {
        throw new Error(
          `音声合成に失敗しました: ${response.status} ${response.statusText}`
        );
      }

      const audioData = await response.arrayBuffer();
      console.log("音声合成が完了しました");
      return audioData;
    } catch (error) {
      console.error("音声合成中にエラーが発生しました:", error);
      throw error;
    }
  }
}
