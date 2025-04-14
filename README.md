# MCP TTS VOICEVOX

VOICEVOXを使用した音声合成MCPサーバー

## 特徴

- **キュー管理機能** - 複数の音声合成リクエストを効率的に処理
- **プリフェッチ** - 次の音声を事前に生成し、再生をスムーズに

## 必要条件

- Node.js
- [VOICEVOXエンジン](https://voicevox.hiroshiba.jp/)

## インストール

```bash
npm install -g @kajidog/mcp-tts-voicevox
```

## 使い方

### MCPサーバーとして

1. VOICEVOXエンジンを起動
2. MCPサーバーを起動

```bash
npx @kajidog/mcp-tts-voicevox
```

### ライブラリとして

プロジェクトに直接インポートして使用することも可能です：

```bash
npm install @kajidog/mcp-tts-voicevox
```

```javascript
import { VoicevoxClient } from "@kajidog/mcp-tts-voicevox";

// クライアントを初期化
const client = new VoicevoxClient({
  url: "http://localhost:50021", // VOICEVOXエンジンのURL
  defaultSpeaker: 1,             // デフォルト話者ID（オプション）
  defaultSpeedScale: 1.0         // デフォルト速度（オプション）
});

// テキストを音声に変換して再生
await client.speak("こんにちは");

// テキストから音声ファイルを生成
const filePath = await client.generateAudioFile("こんにちは", "./output.wav");
```

## 主な機能

- **テキスト読み上げ** (`speak`) - テキストを音声に変換して再生
- **クエリ生成** (`generate_query`) - 音声合成用クエリの作成
- **ファイル生成** (`synthesize_file`) - クエリから音声ファイルを生成

## 環境変数

- `VOICEVOX_URL`: VOICEVOXエンジンのURL（デフォルト: `http://localhost:50021`）

## ライセンス

ISC 
