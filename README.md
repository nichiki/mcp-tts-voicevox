# MCP Sound VOICEVOX

VOICEVOXを使用した音声合成MCPサーバー

## 必要条件

- Node.js
- [VOICEVOXエンジン](https://voicevox.hiroshiba.jp/)

## 使い方

### インストール

```bash
npm install -g @kajidog/mcp-sound-voicevox
```

### 実行

1. VOICEVOXエンジンを起動
2. 以下のコマンドを実行

```bash
npx @kajidog/mcp-sound-voicevox
```

### MCPツールとして使用

```typescript
await mcp.invoke("speak", {
  text: "こんにちは！",
  speaker: 1  // 話者ID（オプション）
});
```

## 環境変数

- `VOICEVOX_URL`: VOICEVOXエンジンのURL（デフォルト: `http://localhost:50021`）

## ライセンス

ISC 