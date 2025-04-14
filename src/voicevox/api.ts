import axios, { AxiosRequestConfig } from "axios";
import { AudioQuery, VoicevoxError } from "./types";
import { handleError } from "./error";

export class VoicevoxApi {
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = this.normalizeUrl(baseUrl);
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
      )}&speaker=${encodeURIComponent(speaker.toString())}`;
      const query = await this.makeRequest<AudioQuery>("post", endpoint, null, {
        "Content-Type": "application/json",
      });

      return query;
    } catch (error) {
      throw handleError("音声クエリ生成中にエラーが発生しました", error);
    }
  }

  /**
   * 音声合成用クエリから音声ファイルを生成
   */
  public async synthesize(
    query: AudioQuery,
    speaker: number = 1
  ): Promise<ArrayBuffer> {
    try {
      return await this.makeRequest<ArrayBuffer>(
        "post",
        `/synthesis?speaker=${encodeURIComponent(speaker.toString())}`,
        query,
        {
          "Content-Type": "application/json",
          Accept: "audio/wav",
        },
        "arraybuffer"
      );
    } catch (error) {
      throw handleError("音声合成中にエラーが発生しました", error);
    }
  }

  /**
   * プリセットを使用してテキストから音声合成用クエリを生成
   */
  public async generateQueryFromPreset(
    text: string,
    presetId: number,
    coreVersion?: string
  ): Promise<AudioQuery> {
    try {
      let endpoint = `/audio_query_from_preset?text=${encodeURIComponent(
        text
      )}&preset_id=${encodeURIComponent(presetId.toString())}`;

      if (coreVersion) {
        endpoint += `&core_version=${encodeURIComponent(coreVersion)}`;
      }

      const query = await this.makeRequest<AudioQuery>("post", endpoint, null, {
        "Content-Type": "application/json",
      });

      return query;
    } catch (error) {
      throw handleError(
        "プリセットを使用した音声クエリ生成中にエラーが発生しました",
        error
      );
    }
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
      const url = `${this.baseUrl}${endpoint}`;
      const config: AxiosRequestConfig = {
        method,
        url,
        data,
        headers,
        responseType,
        timeout: 30000,
      };

      const response = await axios(config);

      if (response.status !== 200) {
        throw new VoicevoxError(
          `APIリクエストに失敗しました: ${response.status}`,
          response.status
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new VoicevoxError(
          `APIリクエストに失敗しました: ${error.message}`,
          error.response?.status || 0
        );
      }
      throw error;
    }
  }

  /**
   * URLの正規化
   * @private
   */
  private normalizeUrl(url: string): string {
    return url.endsWith("/") ? url.slice(0, -1) : url;
  }
}
