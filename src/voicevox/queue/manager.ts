import { v4 as uuidv4 } from "uuid";
import { VoicevoxApi } from "../api";
import { AudioQuery } from "../types";
import {
  QueueItem,
  QueueItemStatus,
  QueueEventType,
  QueueEventListener,
  QueueManager,
} from "./types";
import { AudioFileManager } from "./file-manager";
import { EventManager } from "./event-manager";
import { AudioGenerator } from "./audio-generator";
import { AudioPlayer } from "./audio-player";

// テスト環境かどうかを判定
const isTestEnvironment =
  process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined;

/**
 * VOICEVOXキュー管理クラス
 * 音声合成タスクのキュー管理と実行を担当
 */
export class VoicevoxQueueManager implements QueueManager {
  private queue: QueueItem[] = [];
  private isPlaying: boolean = false;
  private isPaused: boolean = false;
  private prefetchSize: number = 2;
  private currentPlayingItem: QueueItem | null = null;

  // 依存コンポーネント
  private api: VoicevoxApi;
  private fileManager: AudioFileManager;
  private eventManager: EventManager;
  private audioGenerator: AudioGenerator;
  private audioPlayer: AudioPlayer;

  /**
   * コンストラクタ
   * @param apiInstance VOICEVOX APIクライアントのインスタンス
   * @param prefetchSize 事前生成するアイテム数
   */
  constructor(apiInstance: VoicevoxApi, prefetchSize: number = 2) {
    this.api = apiInstance;
    this.prefetchSize = prefetchSize;

    // 依存コンポーネントを初期化
    this.fileManager = new AudioFileManager();
    this.eventManager = new EventManager();
    this.audioGenerator = new AudioGenerator(this.api, this.fileManager);
    this.audioPlayer = new AudioPlayer();
  }

  /**
   * キューに新しいテキストを追加
   */
  async enqueueText(text: string, speaker: number): Promise<QueueItem> {
    const query = await this.audioGenerator.generateQuery(text, speaker);
    return this.enqueueQuery(query, speaker);
  }

  /**
   * キューに音声合成用クエリを追加
   * @param query 音声合成用クエリ
   * @param speaker 話者ID
   * @returns 作成されたキューアイテム
   */
  public async enqueueQuery(
    query: AudioQuery,
    speaker: number
  ): Promise<QueueItem> {
    const item: QueueItem = {
      id: uuidv4(),
      text: "（クエリから生成）",
      speaker,
      status: QueueItemStatus.PENDING,
      createdAt: new Date(),
      query,
    };

    this.queue.push(item);
    this.eventManager.emitEvent(QueueEventType.ITEM_ADDED, item);

    // 非同期で音声生成を開始
    this.audioGenerator
      .generateAudioFromQuery(item, this.updateItemStatus.bind(this))
      .catch((e) => {
        console.error("Unhandled error during generateAudioFromQuery:", e);
      });

    // キュー処理開始
    this.processQueue();

    return item;
  }

  /**
   * キューからアイテムを削除
   * @param itemId 削除するアイテムのID
   * @returns 削除に成功したかどうか
   */
  public async removeItem(itemId: string): Promise<boolean> {
    const index = this.queue.findIndex((item) => item.id === itemId);

    if (index === -1) {
      return false;
    }

    const item = this.queue[index];

    // 一時ファイルがあれば削除
    if (item.tempFile) {
      await this.fileManager.deleteTempFile(item.tempFile);
    }

    // キューから削除
    const removedItem = this.queue.splice(index, 1)[0];
    this.eventManager.emitEvent(QueueEventType.ITEM_REMOVED, removedItem);

    // もし削除されたアイテムが再生中だったら停止
    if (this.currentPlayingItem?.id === itemId) {
      // TODO: 再生停止処理
      this.currentPlayingItem = null;
    }

    return true;
  }

  /**
   * キューをクリア
   */
  public async clearQueue(): Promise<void> {
    // 削除処理中にキューが変更される可能性があるので、先にIDリストを取得
    const itemIdsToDelete = this.queue.map((item) => item.id);

    // 各アイテムに対して削除処理（一時ファイル削除含む）を実行
    await Promise.all(itemIdsToDelete.map((id) => this.removeItem(id)));

    // 念のためキューを空にする（removeItemで空になっているはずだが）
    this.queue = [];

    // 再生状態をリセット
    this.isPlaying = false;
    this.isPaused = false;
    if (this.currentPlayingItem) {
      // TODO: 再生停止処理
      this.currentPlayingItem = null;
    }

    this.eventManager.emitEvent(QueueEventType.QUEUE_CLEARED);
  }

  // --- 再生制御 ---
  public async startPlayback(): Promise<void> {
    if (!this.isPlaying) {
      this.isPlaying = true;
      this.isPaused = false;
      this.eventManager.emitEvent(QueueEventType.PLAYBACK_STARTED);
      this.processQueue();
    }
  }

  public async pausePlayback(): Promise<void> {
    if (this.isPlaying && !this.isPaused) {
      this.isPaused = true;
      // 再生中のアイテムがあれば状態をPAUSEDに変更
      if (this.currentPlayingItem) {
        this.updateItemStatus(this.currentPlayingItem, QueueItemStatus.PAUSED);
      }
      this.eventManager.emitEvent(QueueEventType.PLAYBACK_PAUSED);
    }
  }

  public async resumePlayback(): Promise<void> {
    if (this.isPlaying && this.isPaused) {
      this.isPaused = false;
      // 一時停止中のアイテムがあれば状態をPLAYINGに戻す
      if (this.currentPlayingItem) {
        this.updateItemStatus(this.currentPlayingItem, QueueItemStatus.PLAYING);
      }
      this.eventManager.emitEvent(QueueEventType.PLAYBACK_RESUMED);
      this.processQueue();
    }
  }

  /**
   * 次のアイテムを再生する
   * 最初のREADY状態のアイテムを再生します
   */
  public async playNext(): Promise<void> {
    if (!this.isPlaying) {
      this.isPlaying = true;
    }
    this.isPaused = false;

    // 既に再生中のアイテムがあれば何もしない
    if (this.currentPlayingItem) {
      return;
    }

    const readyItem = this.queue.find(
      (item) => item.status === QueueItemStatus.READY
    );

    if (readyItem && readyItem.tempFile) {
      this.currentPlayingItem = readyItem;
      this.updateItemStatus(readyItem, QueueItemStatus.PLAYING);
      this.eventManager.emitEvent(QueueEventType.PLAYBACK_STARTED);

      try {
        await this.playAudio(readyItem.tempFile);

        // 再生完了
        this.updateItemStatus(readyItem, QueueItemStatus.DONE);
        this.currentPlayingItem = null;

        // 完了したアイテムをキューから削除
        await this.removeItem(readyItem.id);

        // 再生完了イベント発火
        this.eventManager.emitEvent(QueueEventType.PLAYBACK_COMPLETED);
      } catch (error) {
        // 再生エラー時の処理
        this.audioPlayer.logError(
          `音声ファイル再生エラー: ${readyItem.text}`,
          error
        );
        readyItem.error =
          error instanceof Error ? error : new Error(String(error));
        this.updateItemStatus(readyItem, QueueItemStatus.ERROR);
        this.eventManager.emitEvent(QueueEventType.ERROR, readyItem);
        // エラーになったアイテムもキューから削除
        await this.removeItem(readyItem.id);
        this.currentPlayingItem = null;
      }
    }
  }
  // --- 再生制御ここまで ---

  /**
   * イベントリスナーを追加
   */
  public addEventListener(
    event: QueueEventType,
    listener: QueueEventListener
  ): void {
    this.eventManager.addEventListener(event, listener);
  }

  /**
   * イベントリスナーを削除
   */
  public removeEventListener(
    event: QueueEventType,
    listener: QueueEventListener
  ): void {
    this.eventManager.removeEventListener(event, listener);
  }

  /**
   * 現在のキュー内のアイテムを取得
   */
  public getQueue(): QueueItem[] {
    // 不変性を保つためにコピーを返す
    return [...this.queue];
  }

  /**
   * 特定のアイテムの状態を取得
   */
  public getItemStatus(itemId: string): QueueItemStatus | null {
    const item = this.queue.find((item) => item.id === itemId);
    return item ? item.status : null;
  }

  /**
   * キュー内のアイテムを処理 (再生処理のメインループ)
   * @private
   */
  private async processQueue(): Promise<void> {
    if (!this.isPlaying || this.isPaused || this.currentPlayingItem) {
      return;
    }

    const readyItem = this.queue.find(
      (item) => item.status === QueueItemStatus.READY
    );

    if (!readyItem || !readyItem.tempFile) {
      // 再生可能なアイテムがない場合、または一時ファイルがない場合は待機
      setTimeout(() => this.processQueue(), 100);
      return;
    }

    try {
      this.currentPlayingItem = readyItem;
      this.updateItemStatus(readyItem, QueueItemStatus.PLAYING);

      await this.playAudio(readyItem.tempFile);

      // 再生完了後
      this.updateItemStatus(readyItem, QueueItemStatus.DONE);
      this.currentPlayingItem = null;

      // 完了したアイテムをキューから削除
      await this.removeItem(readyItem.id);

      // PLAYBACK_COMPLETEDイベントを発火
      this.eventManager.emitEvent(QueueEventType.PLAYBACK_COMPLETED);

      // 次のアイテム処理を試みる
      this.processQueue();
    } catch (error) {
      // 再生エラー時の処理
      this.audioPlayer.logError(
        `音声ファイル再生エラー: ${readyItem.text}`,
        error
      );
      readyItem.error =
        error instanceof Error ? error : new Error(String(error));
      this.updateItemStatus(readyItem, QueueItemStatus.ERROR);
      this.eventManager.emitEvent(QueueEventType.ERROR, readyItem);
      // エラーになったアイテムもキューから削除
      await this.removeItem(readyItem.id);
      this.currentPlayingItem = null; // 再生中アイテムをリセット
      // 次の処理へ
      this.processQueue();
    }
  }

  /**
   * 次のアイテムの音声を事前に生成 (プリフェッチ)
   * @private
   */
  private async prefetchAudio(): Promise<void> {
    const pendingItems = this.queue.filter(
      (item) => item.status === QueueItemStatus.PENDING
    );
    const processingOrReadyCount = this.queue.filter(
      (item) =>
        item.status === QueueItemStatus.READY ||
        item.status === QueueItemStatus.GENERATING
    ).length;

    const prefetchNeeded = this.prefetchSize - processingOrReadyCount;

    if (prefetchNeeded > 0 && pendingItems.length > 0) {
      const itemsToPrefetch = pendingItems.slice(0, prefetchNeeded);
      await Promise.all(
        itemsToPrefetch.map((item) => {
          if (item.query) {
            return this.audioGenerator
              .generateAudioFromQuery(item, this.updateItemStatus.bind(this))
              .catch((e) => console.error("Prefetch error:", e));
          } else if (item.text) {
            return this.audioGenerator
              .generateAudio(item, this.updateItemStatus.bind(this))
              .catch((e) => console.error("Prefetch error:", e));
          }
          return Promise.resolve();
        })
      );
    }
  }

  /**
   * アイテムの状態を更新し、イベントを発火
   * @param item 状態を更新するアイテム
   * @param status 新しい状態
   * @private
   */
  private updateItemStatus(item: QueueItem, status: QueueItemStatus): void {
    item.status = status;
    // 状態変更イベントを発火
    this.eventManager.emitEvent(QueueEventType.ITEM_STATUS_CHANGED, item);

    // READYになったらプリフェッチとキュー処理をトリガー
    if (status === QueueItemStatus.READY) {
      this.prefetchAudio();
      this.processQueue();
    }
  }

  /**
   * 音声ファイルを再生
   * テスト互換性を保つための内部メソッド
   * @param filePath 再生する音声ファイルのパス
   * @private
   */
  private async playAudio(filePath: string): Promise<void> {
    return this.audioPlayer.playAudio(filePath);
  }

  /**
   * バイナリーデータを一時ファイルに保存
   * @param audioData 音声バイナリーデータ
   * @returns 保存した一時ファイルのパス
   */
  public async saveTempAudioFile(audioData: ArrayBuffer): Promise<string> {
    return this.fileManager.saveTempAudioFile(audioData);
  }
}
