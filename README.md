# MCP TTS VOICEVOX

VOICEVOXを使用した音声合成MCPサーバー

## 必要条件

- Node.js
- [VOICEVOXエンジン](https://voicevox.hiroshiba.jp/)

## 機能概要

- テキストから音声を合成して再生
- テキストから音声合成用クエリを生成
- 音声合成用クエリから音声ファイルを生成
- テキストまたはクエリを音声生成キューに追加

## 使い方

### インストール

```bash
npm install -g @kajidog/mcp-tts-voicevox
```

### 実行

1. VOICEVOXエンジンを起動
2. 以下のコマンドを実行

```bash
npx @kajidog/mcp-tts-voicevox
```

### MCPツールとして使用

#### 1. テキストを音声に変換して再生

```typescript
await mcp.invoke("speak", {
  text: "こんにちは！",  // 読み上げるテキスト
  speaker: 1  // 話者ID（オプション）
});
```

#### 2. テキストから音声合成用クエリを生成

```typescript
const queryResult = await mcp.invoke("generate_query", {
  text: "こんにちは！",  // 音声合成するテキスト
  speaker: 1  // 話者ID（オプション）
});

// 返されたテキストをJSONにパース
const query = JSON.parse(queryResult.content[0].text);
```

#### 3. 音声合成用クエリから音声ファイルを生成

```typescript
const fileResult = await mcp.invoke("synthesize_file", {
  query: query,  // 音声合成用クエリ
  output: "/path/to/output.wav",  // 出力ファイルパス
  speaker: 1  // 話者ID（オプション）
});

// 生成された音声ファイルのパス
const filePath = fileResult.content[0].text;
```

## 活用例

1. **テキストを直接音声に変換**
   - `speak` - 短いテキストをすぐに読み上げたいとき

2. **細かい音声設定をカスタマイズ**
   - `generate_query` → クエリ編集 → `synthesize_file` の流れで高度な調整が可能

3. **バッチ処理で大量の音声ファイルを作成**
   - テキストをクエリに変換してから一括で音声ファイルを生成

## 環境変数

- `VOICEVOX_URL`: VOICEVOXエンジンのURL（デフォルト: `http://localhost:50021`）

## ライセンス

ISC 
