/**
 * MCP TTS Voicevox Client
 * ライブラリとして使用するためのエントリーポイント
 */

// クライアント
export { VoicevoxClient } from "./voicevox";

// 型定義
export {
  AudioQuery,
  VoicevoxConfig,
  VoicevoxError,
  Score,
  Note,
  FrameAudioQuery,
} from "./voicevox/types";

// 一部のコンポーネントを選択的に直接利用できるようにエクスポート
export * from "./voicevox/queue";
export * from "./voicevox/api";
export * from "./voicevox/utils";

// ブラウザ対応
export { isBrowser } from "./voicevox/utils";
