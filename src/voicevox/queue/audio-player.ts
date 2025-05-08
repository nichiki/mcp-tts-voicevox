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
   * @param retryCount 再試行回数（内部使用）
   * @returns 再生完了を示すPromise
   */
  private playAudioInBrowser(
    audioUrl: string,
    retryCount: number = 0
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      try {
        console.debug(
          "再生しようとしているURL:",
          audioUrl,
          "試行回数:",
          retryCount
        );

        // 既存の音声要素があれば停止して削除
        if (this.audioElement) {
          this.audioElement.pause();
          this.audioElement.src = "";
          this.audioElement.load(); // メモリ解放のための明示的なリセット
        }

        // 新しい音声要素を作成
        this.audioElement = new Audio();

        // デバッグ用のイベントリスナー
        this.audioElement.addEventListener("loadstart", () =>
          console.debug("Audio loadstart")
        );
        this.audioElement.addEventListener("durationchange", () =>
          console.debug("Audio durationchange:", this.audioElement?.duration)
        );
        this.audioElement.addEventListener("loadedmetadata", () =>
          console.debug("Audio loadedmetadata")
        );
        this.audioElement.addEventListener("canplay", () =>
          console.debug("Audio canplay")
        );

        // サスペンドイベント処理
        this.audioElement.addEventListener("suspend", () => {
          console.debug("Audio suspended");
        });

        // エラーイベントを詳細に捕捉
        this.audioElement.onerror = (event) => {
          const errorCode = this.audioElement?.error?.code;
          const errorMessage = this.audioElement?.error?.message;

          // 実際にエラーオブジェクトが存在するか確認
          if (errorCode !== undefined || errorMessage) {
            console.error("Audio error details:", {
              code: errorCode,
              message: errorMessage,
              event,
            });

            // 最大3回まで再試行
            if (retryCount < 3) {
              console.warn(
                `再生に失敗しました。再試行します (${retryCount + 1}/3)...`
              );
              // 少し待ってから再試行
              setTimeout(() => {
                this.playAudioInBrowser(audioUrl, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, 300);
              return;
            }

            reject(
              new Error(
                `Audio playback error: ${
                  errorMessage || "Unknown error"
                } (Code: ${errorCode})`
              )
            );
          } else {
            // エラーオブジェクトがないがイベントが発生した場合は警告として扱う
            console.warn(
              "Audio event triggered but no error details available. Continuing playback..."
            );
            // エラーイベントが発生しても実際のエラーがなければ再生を続行
            // ここでrejectしないことで再生を継続
          }
        };

        // 成功イベント
        this.audioElement.onended = () => {
          console.debug("Audio playback completed successfully");
          resolve();
        };

        // 中断イベント
        this.audioElement.onabort = () => {
          console.debug("Audio playback aborted");
          resolve(); // 中断も完了として扱う
        };

        // 事前にpreloadを設定
        this.audioElement.preload = "auto";

        // クロスオリジン設定
        this.audioElement.crossOrigin = "anonymous";

        // ソースを設定してロード
        this.audioElement.src = audioUrl;
        this.audioElement.load();

        // 再生開始
        this.audioElement
          .play()
          .then(() => {
            console.debug("Audio playback started successfully");
          })
          .catch((error) => {
            console.error("Failed to start audio playback:", error);

            // 最大3回まで再試行
            if (retryCount < 3) {
              console.warn(
                `再生開始に失敗しました。再試行します (${retryCount + 1}/3)...`
              );
              // 少し待ってから再試行
              setTimeout(() => {
                this.playAudioInBrowser(audioUrl, retryCount + 1)
                  .then(resolve)
                  .catch(reject);
              }, 300);
              return;
            }

            reject(error);
          });
      } catch (error) {
        console.error("Unexpected error in audio playback:", error);
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
