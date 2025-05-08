// MCP TTS Voicevox エントリーポイント
// ライブラリとしても使用できるように、クライアントとCLIのエントリーポイントを分けて公開

// ライブラリとして使用する場合のエクスポート
export * from "./client";

// CLIとして使用する場合の実行処理
// CommonJSで実行されている場合のみサポート
const isMainModule = typeof require !== "undefined" && require.main === module;

if (isMainModule) {
  // ファイルが直接実行された場合（CLIとして使用）
  import("./stdio").catch((error) => {
    console.error("CLI起動中にエラーが発生しました:", error);
    process.exit(1);
  });
}
