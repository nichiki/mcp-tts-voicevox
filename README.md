# MCP Sound VOICEVOX

VOICEVOXを使用して音声合成を行うModel Context Protocol (MCP) サーバーです。
[VOICEVOX公式サイト](https://voicevox.hiroshiba.jp/)

## 概要

このプロジェクトは、VOICEVOXエンジンと連携して、テキストを音声に変換するMCPサーバーを提供します。主な機能は以下の通りです：

- テキストから音声への変換
- 複数の話者（キャラクター）のサポート
- 長文の自然な分割処理
- 効率的な音声生成とキュー管理

## 必要条件

- Node.js (v16以上推奨)
- VOICEVOXエンジン
- npm または yarn

## セットアップ

1. VOICEVOXエンジンのセットアップ
   - [VOICEVOX公式サイト](https://voicevox.hiroshiba.jp/)からVOICEVOXをダウンロードしインストール
   - VOICEVOXエンジンを起動（デフォルトポート: 50021）

2. プロジェクトのセットアップ
   ```bash
   # 依存関係のインストール
   npm install

   # プロジェクトのビルド
   npm run build
   ```

## 環境変数

- `VOICEVOX_URL`: VOICEVOXエンジンのURL（デフォルト: `http://localhost:50021`）

## 使用方法

### npxを使用した実行

VOICEVOXエンジンが起動している状態で、以下のコマンドを実行するだけで使用できます：

```bash
# VOICEVOXエンジンを起動していることを確認してください
npx @kajidog/mcp-sound-voicevox
```

カスタムポートを使用している場合は、環境変数で指定できます：

```bash
# カスタムポートの指定
VOICEVOX_URL=http://localhost:50022 npx @kajidog/mcp-sound-voicevox
```

### ローカルインストール

1. サーバーの起動
   ```bash
   npm start
   ```

2. MCPツールの使用
   ```typescript
   // speakツールの呼び出し例
   await mcp.invoke("speak", {
     text: "こんにちは！",
     speaker: 1  // オプション: 話者ID（デフォルト: 1）
   });
   ```

## 機能詳細

### テキスト分割
長いテキストは自動的に以下の基準で分割されます：
- 文末（。！？）での区切り
- 自然な区切り（接続詞、助詞など）
- 最大文字数による制限

### 音声生成の最適化
- 音声生成のキュー管理
- プリフェッチによるパフォーマンス向上
- 一時ファイルの自動クリーンアップ

## 開発者向け情報

### プロジェクト構造
```
src/
├── index.ts          # MCPサーバーのメインエントリーポイント
├── voicevox/
│   ├── index.ts      # VOICEVOXクライアントのメインクラス
│   ├── generator.ts  # 音声生成ロジック
│   └── player.ts     # 音声再生管理
└── types/
    └── node-wav.d.ts # WAV関連の型定義
```

### テスト実行
```bash
npm test
```

## ライセンス

ISC

## 注意事項

- VOICEVOXエンジンが起動していることを確認してから使用してください
- 大量のリクエストを送信する場合は、適切な間隔を設けることを推奨します 