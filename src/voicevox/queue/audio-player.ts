import { handleError } from "../error";
import { isTestEnvironment } from "../utils";

// sound-playは型定義がないのでrequireで読み込む
const soundPlay = require("sound-play");

/**
 * 音声再生クラス
 * 音声ファイルの再生処理を担当
 */
export class AudioPlayer {
  /**
   * 音声ファイルを再生
   * @param filePath 再生する音声ファイルのパス
   */
  public async playAudio(filePath: string): Promise<void> {
    try {
      await soundPlay.play(filePath);
    } catch (error) {
      // エラー発生時はハンドリングして再スロー
      throw handleError(
        `音声ファイルの再生中にエラーが発生しました: ${filePath}`,
        error
      );
    }
  }

  /**
   * エラーをログ出力
   * @param message エラーメッセージ
   * @param error エラーオブジェクト
   */
  public logError(message: string, error: unknown): void {
    // テスト環境ではエラーログを出力しない
    if (!isTestEnvironment()) {
      console.error(message, error);
    }
  }
}
