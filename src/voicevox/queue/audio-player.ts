import { handleError } from "../error";
import { isBrowser, isTestEnvironment } from "../utils";

// sound-playは型定義がないのでrequireで読み込む
let soundPlay: any;
if (!isBrowser()) {
  try {
    soundPlay = require("sound-play");
  } catch (error) {
    console.warn(
      "sound-play module could not be loaded. Audio playback may not work."
    );
  }
}

/**
 * 音声再生クラス
 * 音声ファイルの再生処理を担当
 */
export class AudioPlayer {
  private audioElement: HTMLAudioElement | null = null;

  /**
   * 音声ファイルを再生
   * @param filePath 再生する音声ファイル、またはブラウザ環境ではblobURL
   */
  public async playAudio(filePath: string): Promise<void> {
    try {
      if (isBrowser()) {
        // ブラウザでの再生
        return this.playAudioInBrowser(filePath);
      } else {
        // Node.js環境での再生
        if (!soundPlay) {
          throw new Error("sound-play module is not available");
        }
        await soundPlay.play(filePath);
      }
    } catch (error) {
      // エラー発生時はハンドリングして再スロー
      throw handleError(
        `音声ファイルの再生中にエラーが発生しました: ${filePath}`,
        error
      );
    }
  }

  /**
   * ブラウザ環境での音声再生
   * @param audioUrl 再生するblobURL
   * @returns 再生完了を示すPromise
   */
  private playAudioInBrowser(audioUrl: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        // 既存の音声要素があれば停止して削除
        if (this.audioElement) {
          this.audioElement.pause();
          this.audioElement.src = "";
        }

        // 新しい音声要素を作成
        this.audioElement = new Audio(audioUrl);

        // イベントリスナーを設定
        this.audioElement.onended = () => {
          resolve();
        };

        this.audioElement.onerror = (event) => {
          reject(
            new Error(
              `Audio playback error: ${
                this.audioElement?.error?.message || "Unknown error"
              }`
            )
          );
        };

        // 再生開始
        this.audioElement.play().catch((error) => {
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
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
