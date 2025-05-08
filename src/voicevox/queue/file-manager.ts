// ブラウザ環境でインポートエラーを避けるための条件付きインポート
import { isBrowser } from "../utils";

// Node.js環境でのみ必要なモジュール
let fsPromises: any;
let path: any;
let os: any;

// ブラウザ以外の環境でのみインポート
if (!isBrowser()) {
  fsPromises = require("fs/promises");
  path = require("path");
  os = require("os");
}

import { v4 as uuidv4 } from "uuid";
import { handleError } from "../error";

/**
 * バイナリデータをUint8Arrayに変換（環境に依存しない方法）
 * @param data ArrayBufferデータ
 * @returns Uint8Array
 */
function arrayBufferToUint8Array(data: ArrayBuffer): Uint8Array {
  if (data instanceof Uint8Array) {
    return data;
  }
  return new Uint8Array(data);
}

/**
 * 一時ファイル管理クラス
 * 音声ファイルの一時保存と削除を担当
 */
export class AudioFileManager {
  /**
   * 一時ファイルのパスを生成
   * @returns 一時ファイルのフルパス
   */
  public createTempFilePath(): string {
    const uniqueFilename = `voicevox-${uuidv4()}.wav`;
    if (isBrowser()) {
      return uniqueFilename;
    }
    return path.join(os.tmpdir(), uniqueFilename);
  }

  /**
   * 一時ファイルを削除
   * @param filePath 削除するファイルのパス
   */
  public async deleteTempFile(filePath: string): Promise<void> {
    // ブラウザでは不要
    if (isBrowser()) return;

    try {
      await fsPromises.unlink(filePath);
    } catch (error: any) {
      // ファイルが存在しないエラー(ENOENT)は無視して良い
      if (error.code !== "ENOENT") {
        console.error(
          `一時ファイルの削除中にエラーが発生しました: ${filePath}`,
          error
        );
      }
    }
  }

  /**
   * バイナリーデータを一時ファイルに保存
   * @param audioData 音声バイナリーデータ
   * @param filename ファイル名（オプション、ブラウザ環境でのダウンロード時に使用）
   * @returns 保存した一時ファイルのパス、またはブラウザ環境ではデータURL
   */
  public async saveTempAudioFile(
    audioData: ArrayBuffer,
    filename?: string
  ): Promise<string> {
    try {
      if (isBrowser()) {
        // ブラウザ環境ではデータURLを返す代わりにダウンロードを促す
        const blob = new Blob([audioData], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        // ファイル名を指定するかランダム生成
        const outputFilename = filename || `voicevox-${uuidv4()}.wav`;

        return new Promise<string>((resolve) => {
          // aタグを作成してダウンロードを実行
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = outputFilename;

          // ダウンロード完了またはキャンセル時の処理
          const cleanup = () => {
            // クリーンアップ
            window.removeEventListener("focus", cleanup);
            setTimeout(() => {
              // DOMからの削除
              if (document.body.contains(a)) {
                document.body.removeChild(a);
              }
              // URLの解放
              URL.revokeObjectURL(url);
              resolve(outputFilename);
            }, 100);
          };

          // Safariなどでのダウンロード完了を検知するためのイベントリスナー
          window.addEventListener("focus", cleanup);

          // bodyに追加して強制的にクリック
          document.body.appendChild(a);
          a.click();

          // タイムアウトも設定（フォールバック）
          setTimeout(cleanup, 1000);
        });
      }

      // Node.js環境ではファイルに保存
      const tempFilePath = this.createTempFilePath();
      const data = arrayBufferToUint8Array(audioData);
      await fsPromises.writeFile(tempFilePath, data);
      return tempFilePath;
    } catch (error) {
      throw handleError("音声ファイルの保存に失敗しました", error);
    }
  }

  /**
   * バイナリーデータを指定されたパスに保存
   * @param audioData 音声バイナリーデータ
   * @param output 出力ファイルパスまたは出力ディレクトリ
   * @returns 保存したファイルのパス、またはブラウザ環境ではダウンロードの結果
   */
  public async saveAudioFile(
    audioData: ArrayBuffer,
    output: string
  ): Promise<string> {
    try {
      if (isBrowser()) {
        // ブラウザ環境ではダウンロードを提供
        const blob = new Blob([audioData], { type: "audio/wav" });
        const url = URL.createObjectURL(blob);

        // ファイル名の処理を改善
        const filename = output || `voice-${uuidv4()}.wav`;

        return new Promise<string>((resolve) => {
          // aタグを作成してダウンロードを実行
          const a = document.createElement("a");
          a.style.display = "none";
          a.href = url;
          a.download = filename;

          // ダウンロード完了またはキャンセル時の処理
          const cleanup = () => {
            // クリーンアップ
            window.removeEventListener("focus", cleanup);
            setTimeout(() => {
              // DOMからの削除
              if (document.body.contains(a)) {
                document.body.removeChild(a);
              }
              // URLの解放
              URL.revokeObjectURL(url);
              resolve(filename);
            }, 100);
          };

          // Safariなどでのダウンロード完了を検知するためのイベントリスナー
          window.addEventListener("focus", cleanup);

          // bodyに追加して強制的にクリック
          document.body.appendChild(a);
          a.click();

          // タイムアウトも設定（フォールバック）
          setTimeout(cleanup, 1000);

          // コンソールにログを出力（デバッグ用）
          console.log(`ダウンロード開始: ${filename}`);
        });
      }

      // Node.js環境での処理
      // 出力が実際にディレクトリかファイルパスか判断
      let targetPath = output;
      let isDir = false;

      try {
        const outputStat = await fsPromises.stat(output);
        isDir = outputStat.isDirectory();
      } catch (err) {
        // ファイルまたはディレクトリが存在しない場合
        // 末尾がスラッシュで終わる場合はディレクトリと見なす
        isDir = output.endsWith("/") || output.endsWith("\\");
      }

      // ディレクトリの場合、ファイル名を生成
      if (isDir) {
        const filename = `voice-${uuidv4()}.wav`;
        targetPath = path.join(output, filename);
      }

      // 出力ディレクトリが存在するか確認し、存在しない場合は作成
      await fsPromises.mkdir(path.dirname(targetPath), { recursive: true });

      // 音声データを指定された出力先に書き込み
      const data = arrayBufferToUint8Array(audioData);
      await fsPromises.writeFile(targetPath, data);

      return targetPath;
    } catch (error) {
      throw handleError("音声ファイルの保存に失敗しました", error);
    }
  }
}
