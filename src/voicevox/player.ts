import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { exec } from "child_process";
import { promisify } from "util";
import axios from "axios";

const execAsync = promisify(exec);
const sound = require("sound-play");

interface QueueItem {
  text: string;
  speaker: number;
  audioData?: ArrayBuffer;
  tempFile?: string;
}

export class VoicevoxPlayer {
  private voicevoxUrl: string;
  private queue: QueueItem[] = [];
  private isPlaying: boolean = false;
  private isGenerating: boolean = false;
  private prefetchSize: number = 2; // プリフェッチするアイテム数

  constructor(voicevoxUrl: string = "http://localhost:50021") {
    this.voicevoxUrl = voicevoxUrl;
  }

  // キューに追加
  public async enqueue(text: string, speaker: number = 1): Promise<void> {
    const item = { text, speaker };
    this.queue.push(item);
    await this.generateAudio(item); // 音声データの生成を待つ
    this.prefetchAudio(); // 次の音声の事前生成を開始
    this.processQueue(); // 再生キューの処理を開始
  }

  // キューをクリア
  public clearQueue(): void {
    this.queue = [];
  }

  // 音声の事前生成
  private async prefetchAudio(): Promise<void> {
    if (this.isGenerating) return;

    this.isGenerating = true;
    try {
      // プリフェッチサイズまでの音声を生成
      const itemsToGenerate = this.queue
        .filter((item) => !item.audioData)
        .slice(0, this.prefetchSize);
      await Promise.all(
        itemsToGenerate.map((item) => this.generateAudio(item))
      );
    } catch (error) {
      console.error("音声の事前生成中にエラーが発生しました:", error);
    } finally {
      this.isGenerating = false;
    }
  }

  // 音声生成処理
  private async generateAudio(item: QueueItem): Promise<void> {
    try {
      // 音声クエリを生成
      const queryResponse = await axios.post(
        `${this.voicevoxUrl}/audio_query?text=${encodeURIComponent(
          item.text
        )}&speaker=${item.speaker}`,
        null,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (queryResponse.status !== 200) {
        throw new Error(
          `音声クエリの生成に失敗しました: ${queryResponse.status}`
        );
      }
      const query = queryResponse.data;

      // 音声を合成
      const synthesisResponse = await axios.post(
        `${this.voicevoxUrl}/synthesis?speaker=${item.speaker}`,
        query,
        {
          responseType: "arraybuffer",
          headers: {
            "Content-Type": "application/json",
            Accept: "audio/wav",
          },
        }
      );
      if (synthesisResponse.status !== 200) {
        throw new Error(`音声合成に失敗しました: ${synthesisResponse.status}`);
      }

      // 音声データを保存
      item.audioData = synthesisResponse.data;

      // 一時ファイルに保存
      if (item.audioData) {
        const tempFile = join(tmpdir(), `voicevox-${Date.now()}.wav`);
        await writeFile(tempFile, Buffer.from(item.audioData));
        item.tempFile = tempFile;
      }
    } catch (error) {
      console.error("音声生成中にエラーが発生しました:", error);
      throw error;
    }
  }

  // キューの処理
  private async processQueue(): Promise<void> {
    if (this.isPlaying || this.queue.length === 0) {
      return;
    }

    this.isPlaying = true;
    try {
      while (this.queue.length > 0) {
        const item = this.queue[0];

        // 音声データが生成されるまで待機
        while (!item.audioData) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        console.log(`キューから再生: "${item.text}" (話者: ${item.speaker})`);

        // 音声を再生
        if (item.tempFile) {
          await sound.play(item.tempFile);
          // 再生が完了したら一時ファイルを削除
          try {
            await unlink(item.tempFile);
          } catch (error) {
            console.warn("一時ファイルの削除に失敗しました:", error);
          }
        }

        // キューから削除
        this.queue.shift();

        // 次の音声の事前生成を開始
        this.prefetchAudio();
      }
    } catch (error) {
      console.error("キュー処理中にエラーが発生しました:", error);
    } finally {
      this.isPlaying = false;
    }
  }
}
