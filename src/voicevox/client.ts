import fetch from "node-fetch";

export class VoicevoxClient {
  private voicevoxUrl: string;

  constructor(voicevoxUrl: string = "http://localhost:50021") {
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
      return audioData;
    } catch (error) {
      console.error("音声合成中にエラーが発生しました:", error);
      throw error;
    }
  }
}
