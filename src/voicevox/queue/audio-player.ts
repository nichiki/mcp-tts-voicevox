import { handleError } from "../error";
import { isBrowser, isTestEnvironment } from "../utils";

// sound-playは動的インポートで読み込み
let soundPlay: any = null;

// ブラウザではない場合のみ読み込みを試行
if (!isBrowser()) {
  // 非同期で読み込み試行
  (async () => {
    try {
      // 動的インポートを試みる
      soundPlay = await import("sound-play").catch(() => {
        // 通常のimportが失敗した場合、requireを試す（古いNode.js環境向け）
        return require("sound-play");
      });
    } catch (error) {
      console.warn(
        "sound-play module could not be loaded. Audio playback may not work. Please ensure it is installed correctly.",
        error
      );
    }
  })();
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
          // モジュールが読み込めなかった場合、もう一度読み込みを試みる
          try {
            soundPlay = await import("sound-play").catch(() =>
              require("sound-play")
            );
          } catch (err) {
            throw new Error(
              "sound-play module is not available. Please ensure it is installed with 'npm install sound-play'"
            );
          }
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
