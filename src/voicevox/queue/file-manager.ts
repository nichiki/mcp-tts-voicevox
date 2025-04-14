import * as fsPromises from "fs/promises";
import { join, dirname } from "path";
import { tmpdir } from "os";
import { v4 as uuidv4 } from "uuid";
import { handleError } from "../error";

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
    return join(tmpdir(), uniqueFilename);
  }

  /**
   * 一時ファイルを削除
   * @param filePath 削除するファイルのパス
   */
  public async deleteTempFile(filePath: string): Promise<void> {
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
   * @returns 保存した一時ファイルのパス
   */
  public async saveTempAudioFile(audioData: ArrayBuffer): Promise<string> {
    try {
      const tempFilePath = this.createTempFilePath();
      await fsPromises.writeFile(tempFilePath, Buffer.from(audioData));
      return tempFilePath;
    } catch (error) {
      throw handleError("音声ファイルの保存に失敗しました", error);
    }
  }

  /**
   * バイナリーデータを指定されたパスに保存
   * @param audioData 音声バイナリーデータ
   * @param output 出力ファイルパスまたは出力ディレクトリ
   * @returns 保存したファイルのパス
   */
  public async saveAudioFile(
    audioData: ArrayBuffer,
    output: string
  ): Promise<string> {
    try {
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
        targetPath = join(output, filename);
      }

      // 出力ディレクトリが存在するか確認し、存在しない場合は作成
      await fsPromises.mkdir(dirname(targetPath), { recursive: true });

      // 音声データを指定された出力先に書き込み
      await fsPromises.writeFile(targetPath, Buffer.from(audioData));

      return targetPath;
    } catch (error) {
      throw handleError("音声ファイルの保存に失敗しました", error);
    }
  }
}
