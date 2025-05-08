#!/usr/bin/env node
// MCP TTS Voicevox エントリーポイント
// ライブラリとしても使用できるように、クライアントとCLIのエントリーポイントを分けて公開

// ライブラリとして使用する場合のエクスポート
export * from "./client";

// ブラウザ環境かどうかをチェックする関数
const isBrowser = () => {
  return (
    typeof window !== "undefined" && typeof window.document !== "undefined"
  );
};

// Node.js環境の場合のみCLI処理を実行
if (!isBrowser()) {
  try {
    // ファイルが直接実行された場合を検出する方法を改善
    // process.envで実行モードを判定（CLIとして実行されているかどうかを確認）
    const isCLI =
      typeof process !== "undefined" &&
      !!(
        (
          process.argv &&
          process.argv.length > 1 && // コマンドライン引数がある
          ((process.env && process.env.npm_lifecycle_event === "start") || // npm start で実行
            process.argv[1]?.includes("mcp-tts-voicevox") || // NPXやバイナリ名で実行
            process.argv[1]?.endsWith("dist/index.js") || // 直接JSファイルとして実行
            process.argv[1]?.endsWith("src/index.ts"))
        ) // ts-nodeなどで実行
      );

    // NPX経由で実行されたことを明示的に検出
    const isNpx =
      typeof process !== "undefined" &&
      !!(
        process.env &&
        process.env.npm_execpath &&
        process.argv[1] &&
        !process.argv[1].includes("node_modules")
      );

    if (isCLI || isNpx) {
      // CLIモードで実行（ログ出力を削除）

      // 同期的にstdioモジュールを読み込んで実行
      try {
        // ts-nodeや開発環境ではESモジュールとして読み込む
        if (
          typeof process !== "undefined" &&
          process.env &&
          process.env.NODE_ENV === "development"
        ) {
          import("./stdio").catch(() => {
            // エラーログを出力せずに終了
            if (typeof process !== "undefined") {
              process.exit(1);
            }
          });
        } else {
          // 本番環境ではCommonJSとして読み込む
          try {
            // requireが利用可能な場合のみ実行
            if (typeof require !== "undefined") {
              require("./stdio");
            }
          } catch (error) {
            // エラーログを出力せずに終了
            if (typeof process !== "undefined") {
              process.exit(1);
            }
          }
        }
      } catch (error) {
        // エラーログを出力せずに終了
        if (typeof process !== "undefined") {
          process.exit(1);
        }
      }
    }
  } catch (error) {
    // エラーを抑制（何もしない）
  }
}
