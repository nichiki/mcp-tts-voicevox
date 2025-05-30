# MCP TTS VOICEVOX

VOICEVOX を使用した音声合成 MCP サーバー

## 特徴

- **キュー管理機能** - 複数の音声合成リクエストを効率的に処理
- **プリフェッチ** - 次の音声を事前に生成し、再生をスムーズに
- **クロスプラットフォーム対応** - Windows、macOS で動作
- **マルチ環境対応** - Node.js（ライブラリ/CLI）とブラウザの環境で利用可能
- **ファイルダウンロード機能** - ブラウザ環境での音声ファイル保存をサポート
- **Stdio 対応** - 標準入出力による MCP プロトコル通信（Claude Desktop 等で推奨）
- **SSE 対応** - Server-Sent Events によるリアルタイム対話形式音声再生
- **StreamableHTTP 対応** - ストリーミング形式での HTTP 通信による高速音声合成
- **対話形式音声再生** - チャット形式でのリアルタイム音声合成・再生機能
- **複数話者対応** - セグメント単位での個別話者指定が可能
- **テキスト自動分割** - 長文の自動分割による安定した音声合成

## 必要条件

- Node.js 18.0.0 以上
- [VOICEVOX エンジン](https://voicevox.hiroshiba.jp/) または互換エンジン

## インストール

```bash
npm install -g @kajidog/mcp-tts-voicevox
```

## 使い方

### MCP サーバーとして

#### 1. VOICEVOX エンジンを起動

VOICEVOX エンジンを起動し、デフォルトポート（`http://localhost:50021`）で待機状態にします。

#### 2. MCP サーバーを起動

**標準入出力モード（推奨）:**

```bash
npx @kajidog/mcp-tts-voicevox
```

**HTTP サーバーモード:**

```bash
# Linux/macOS
MCP_HTTP_MODE=true npx @kajidog/mcp-tts-voicevox

# Windows PowerShell
$env:MCP_HTTP_MODE='true'; npx @kajidog/mcp-tts-voicevox
```

### MCP ツール一覧

MCP サーバーは以下のツールを提供します：

#### `speak` - テキスト読み上げ

テキストを音声に変換して再生します。

**パラメータ:**

- `text`: 文字列配列、またはテキストと話者ペアの配列
- `speaker` (オプション): 話者 ID
- `speedScale` (オプション): 再生速度
- `query` (オプション): 事前生成済みクエリ

**使用例:**

```javascript
// シンプルなテキスト
{ "text": ["こんにちは", "今日はいい天気ですね"] }

// 話者指定
{ "text": ["こんにちは", "今日はいい天気ですね"], "speaker": 3 }

// セグメント別話者指定
{ "text": [{"text": "こんにちは", "speaker": 1}, {"text": "今日はいい天気ですね", "speaker": 3}] }
```

#### `generate_query` - クエリ生成

音声合成用クエリを生成します。

**パラメータ:**

- `text`: 合成するテキスト
- `speaker` (オプション): 話者 ID
- `speedScale` (オプション): 再生速度

#### `synthesize_file` - ファイル生成

音声ファイルを生成し、パスを返します。

**パラメータ:**

- `text` (オプション): 合成するテキスト
- `query` (オプション): 事前生成済みクエリ
- `output`: 出力ファイルパス
- `speaker` (オプション): 話者 ID
- `speedScale` (オプション): 再生速度

#### `stop_speaker` - 再生停止

現在の音声合成キューをクリアします。

#### `get_speakers` - 話者一覧取得

利用可能な話者一覧を取得します。

#### `get_speaker_detail` - 話者詳細取得

指定した UUID の話者詳細情報を取得します。

**パラメータ:**

- `uuid`: 話者 UUID

### 対話形式音声再生の使用例

#### StreamableHTTP を使用した対話形式再生

```javascript
// セッション初期化
const response = await fetch("http://localhost:3000/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
    },
    id: 1,
  }),
});

const sessionData = await response.json();
const sessionId = response.headers.get("mcp-session-id");

// 音声合成・再生リクエスト
const speakResponse = await fetch("http://localhost:3000/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "mcp-session-id": sessionId,
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "speak",
      arguments: {
        text: ["こんにちは、対話形式で音声を再生します"],
        speaker: 1,
        speedScale: 1.0,
      },
    },
    id: 2,
  }),
});

const result = await speakResponse.json();
console.log("結果:", result);
```

#### 複数話者を使用した対話例

```javascript
// 複数話者での会話例
const conversationResponse = await fetch("http://localhost:3000/mcp", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "mcp-session-id": sessionId,
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "speak",
      arguments: {
        text: [
          { text: "こんにちは！", speaker: 1 },
          { text: "お元気ですか？", speaker: 3 },
          { text: "とても元気です！", speaker: 1 },
        ],
      },
    },
    id: 3,
  }),
});
```

#### SSE を使用した対話形式再生（レガシー）

```javascript
// SSE接続の確立
const eventSource = new EventSource("http://localhost:3000/sse");
let sessionId = null;

eventSource.onopen = function (event) {
  console.log("SSE接続が確立されました");
};

eventSource.onmessage = function (event) {
  const data = JSON.parse(event.data);

  if (data.type === "session") {
    sessionId = data.sessionId;
    console.log("セッションID:", sessionId);

    // 音声合成リクエストを送信
    sendSpeakRequest();
  }
};

async function sendSpeakRequest() {
  await fetch(`http://localhost:3000/messages?sessionId=${sessionId}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "speak",
        arguments: {
          text: ["SSEを使用した音声再生です"],
          speaker: 1,
        },
      },
      id: 1,
    }),
  });
}
```

### ライブラリとして

プロジェクトに直接インポートして使用することも可能です：

```bash
npm install @kajidog/mcp-tts-voicevox
```

#### Node.js 環境での使用例

```javascript
import { VoicevoxClient } from "@kajidog/mcp-tts-voicevox";

// クライアントを初期化
const client = new VoicevoxClient({
  url: "http://localhost:50021", // VOICEVOXエンジンのURL
  defaultSpeaker: 1, // デフォルト話者ID（オプション）
  defaultSpeedScale: 1.0, // デフォルト速度（オプション）
});

// テキストを音声に変換して再生
await client.speak("こんにちは");

// 配列でのテキスト読み上げ
await client.speak(["こんにちは", "今日はいい天気ですね"]);

// 話者を個別指定
await client.speak([
  { text: "こんにちは", speaker: 1 },
  { text: "お元気ですか？", speaker: 3 },
]);

// テキストから音声ファイルを生成
const filePath = await client.generateAudioFile("こんにちは", "./output.wav");

// キューをクリア
await client.clearQueue();

// スピーカー一覧を取得
const speakers = await client.getSpeakers();

// スピーカー詳細を取得
const speakerInfo = await client.getSpeakerInfo(speakers[0].speaker_uuid);
```

#### ブラウザ環境での使用例

```javascript
import { VoicevoxClient } from "@kajidog/mcp-tts-voicevox";

// クライアントを初期化（VOICEVOXエンジンが稼働しているURLを指定）
const client = new VoicevoxClient({
  url: "http://localhost:50021",
  defaultSpeaker: 1,
});

// ボタンクリックでテキストを音声に変換して再生
document.querySelector("#playButton").addEventListener("click", async () => {
  await client.speak("こんにちは");
});

// ファイルダウンロードボタン
document
  .querySelector("#downloadButton")
  .addEventListener("click", async () => {
    try {
      // 音声ファイルを生成してダウンロード（ファイル名を指定）
      const filename = `voice-${Date.now()}.wav`;
      const result = await client.generateAudioFile("こんにちは", filename);
      console.log("ダウンロードしたファイル:", result);
    } catch (error) {
      console.error("エラー:", error);
    }
  });
```

## MCP 設定例

### Claude Desktop での設定

`mcp.json`ファイルに以下の設定を追加：

```json
{
  "mcpServers": {
    "tts-mcp": {
      "command": "npx",
      "args": ["-y", "@kajidog/mcp-tts-voicevox"],
      "env": {
        "VOICEVOX_URL": "http://localhost:50021",
        "VOICEVOX_DEFAULT_SPEAKER": "1"
      }
    }
  }
}
```

### AivisSpeech での設定例

```json
{
  "mcpServers": {
    "tts-mcp": {
      "command": "npx",
      "args": ["-y", "@kajidog/mcp-tts-voicevox"],
      "env": {
        "VOICEVOX_URL": "http://127.0.0.1:10101",
        "VOICEVOX_DEFAULT_SPEAKER": "888753764"
      }
    }
  }
}
```

### HTTP モードでの設定

```json
{
  "mcpServers": {
    "tts-mcp-http": {
      "command": "npx",
      "args": ["-y", "@kajidog/mcp-tts-voicevox"],
      "env": {
        "MCP_HTTP_MODE": "true",
        "MCP_HTTP_PORT": "3000",
        "MCP_HTTP_HOST": "0.0.0.0",
        "VOICEVOX_URL": "http://localhost:50021",
        "VOICEVOX_DEFAULT_SPEAKER": "1"
      }
    }
  }
}
```

## 環境変数

### VOICEVOX 設定

- `VOICEVOX_URL`: VOICEVOX エンジンの URL（デフォルト: `http://localhost:50021`）
- `VOICEVOX_DEFAULT_SPEAKER`: デフォルト話者 ID（デフォルト: `1`）
- `VOICEVOX_DEFAULT_SPEED_SCALE`: デフォルト再生速度（デフォルト: `1.0`）

### サーバー設定

- `MCP_HTTP_MODE`: HTTP サーバーモードの有効化（`true` で有効）
- `MCP_HTTP_PORT`: HTTP サーバーのポート番号（デフォルト: `3000`）
- `MCP_HTTP_HOST`: HTTP サーバーのホスト（デフォルト: `0.0.0.0`）
- `NODE_ENV`: 開発モード（`development` で有効）

## トラブルシューティング

### VOICEVOX エンジンの確認

1. VOICEVOX エンジンが起動していることを確認：

   ```bash
   curl http://localhost:50021/speakers
   ```

2. ファイアウォールやセキュリティソフトがポートをブロックしていないか確認

### Stdio モードの問題

#### MCP クライアントで認識されない場合

1. パッケージが正しくインストールされているか確認：

   ```bash
   npm list -g @kajidog/mcp-tts-voicevox
   ```

2. 実行権限があることを確認：

   ```bash
   # Linux/macOS
   chmod +x $(npm root -g)/@kajidog/mcp-tts-voicevox/dist/index.js
   ```

3. Claude Desktop の場合、設定ファイルの構文が正しいか確認

#### 環境変数の設定例

```bash
# Linux/macOS の .bashrc または .zshrc
export VOICEVOX_URL="http://localhost:50021"
export VOICEVOX_DEFAULT_SPEAKER="1"

# Windows PowerShell Profile
$env:VOICEVOX_URL="http://localhost:50021"
$env:VOICEVOX_DEFAULT_SPEAKER="1"
```

### HTTP モードの問題

#### ポート競合

ポート 3000 が使用中の場合：

```bash
MCP_HTTP_PORT=3001 npx @kajidog/mcp-tts-voicevox
```

#### CORS エラー

ブラウザからアクセスする際に CORS エラーが発生する場合、VOICEVOX エンジン側でも CORS 設定が必要です。

### 権限エラー

ファイル生成時に権限エラーが発生する場合：

```bash
# Linux/macOS
chmod +x node_modules/.bin/mcp-tts-voicevox

# または
sudo npm install -g @kajidog/mcp-tts-voicevox
```

### 音声再生されない場合

1. システムの音声出力デバイスが正しく設定されているか確認
2. 他のアプリケーションが音声デバイスを占有していないか確認
3. VOICEVOX エンジンが正常に動作しているか確認：
   ```bash
   curl -X POST "http://localhost:50021/audio_query?text=テスト&speaker=1"
   ```

## 開発

### 開発環境の起動

```bash
# 標準入出力モード
npm run dev

# HTTPモード
npm run dev:http
```

### ビルド

```bash
npm run build
```

### テスト実行

```bash
# 音声テスト
npm run test:sound

# 単体テスト
npm test
```

### 各モードの動作確認

#### 1. ライブラリモードの確認

```bash
# ライブラリとして正常にインポートできるかテスト
node -e "const { VoicevoxClient } = require('@kajidog/mcp-tts-voicevox'); console.log('✅ Library import successful:', typeof VoicevoxClient);"
```

#### 2. CLI/Stdio モードの確認

```bash
# Stdioモードで起動（MCP標準プロトコル通信）
npx @kajidog/mcp-tts-voicevox

# または、ローカルビルド版で確認
node dist/index.js
```

#### 3. HTTP モードの確認

```bash
# HTTPサーバーモードで起動
MCP_HTTP_MODE=true npx @kajidog/mcp-tts-voicevox

# ヘルスチェック（別ターミナルで実行）
curl http://localhost:3000/health

# Windowsの場合
$env:MCP_HTTP_MODE='true'; npx @kajidog/mcp-tts-voicevox
Invoke-WebRequest -Uri http://localhost:3000/health
```

#### 4. ブラウザモードの確認

ブラウザ環境での動作確認は、Web アプリケーション内で以下のようにテストできます：

```javascript
// ESModule import
import { VoicevoxClient } from "@kajidog/mcp-tts-voicevox";

// CommonJS require (Webpack等のバンドラー経由)
const { VoicevoxClient } = require("@kajidog/mcp-tts-voicevox");

// クライアント初期化
const client = new VoicevoxClient({
  url: "http://localhost:50021",
  defaultSpeaker: 1,
});

// 動作確認
console.log("✅ Browser library loaded successfully");
```

## ブラウザ互換性

- **Chrome, Firefox, Edge**: 完全対応
- **Safari**: ファイルダウンロードに特殊対応あり

## パフォーマンス最適化

- **テキスト分割**: 長文は自動的に 150 文字以下に分割されます
- **非同期処理**: 最初のセグメントを優先処理し、残りは非同期で処理
- **キュー管理**: 複数のリクエストを効率的に管理
- **プリフェッチ**: 次の音声を事前生成してスムーズな再生を実現

## ライセンス

ISC

[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/kajidog-mcp-tts-voicevox-badge.png)](https://mseep.ai/app/kajidog-mcp-tts-voicevox)
