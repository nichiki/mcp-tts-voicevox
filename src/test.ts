import { VoicevoxClient, AudioQuery } from "./voicevox";
import { join } from "path";
import { tmpdir } from "os";
import * as fs from "fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// クライアントテスト
async function testClient() {
  try {
    console.log("=== VoicevoxClient直接テスト ===");
    const client = new VoicevoxClient({
      url: "http://localhost:50021",
      defaultSpeaker: 1,
    });

    // テスト用のテキスト
    const testText = "これはテストです。VOICEVOXの機能を検証します。";
    const speaker = 1; // 四国めたん (ノーマル)

    // 1. speak テスト - テキストからの音声再生
    console.log("\n----- テキストから音声再生のテスト -----");
    const speakResult = await client.speak(testText, speaker);
    console.log(speakResult);

    // 2. generateQuery テスト - テキストから音声合成用クエリを生成
    console.log("\n----- テキストから音声合成用クエリ生成のテスト -----");
    const query = await client.generateQuery(testText, speaker);
    console.log(
      "クエリ生成結果 (一部):",
      JSON.stringify(query).substring(0, 100) + "..."
    );

    // 3. synthesizeToFile テスト - クエリから音声ファイルを生成
    console.log("\n----- クエリから音声ファイル生成のテスト -----");
    const outputPath = join(tmpdir(), `voicevox-test-${Date.now()}.wav`);
    const filePath = await client.generateAudioFile(query, outputPath, speaker);
    console.log(`音声ファイル生成結果: ${filePath}`);

    // ファイルが存在するか確認
    const fileExists = await fs
      .stat(filePath)
      .then(() => true)
      .catch(() => false);
    console.log(`ファイルが存在するか: ${fileExists}`);

    // 4. generateAudioFile テスト - テキストから直接音声ファイルを生成
    console.log("\n----- テキストから直接音声ファイル生成のテスト -----");
    const directFilePath = await client.generateAudioFile(
      "直接ファイルに変換するテスト。",
      join(tmpdir(), `voicevox-direct-${Date.now()}.wav`),
      speaker
    );
    console.log(`直接音声ファイル生成結果: ${directFilePath}`);

    // 5. enqueueAudioGeneration テスト - クエリを使って音声生成キューに追加
    console.log("\n----- クエリを使って音声生成キューへの追加テスト -----");
    const enqueueResult = await client.enqueueAudioGeneration(query, speaker);
    console.log(enqueueResult);

    // 待機してキューの処理が完了するのを待つ
    console.log("\n音声再生を待機しています...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    return query; // 後のテストで使用するためにクエリを返す
  } catch (error) {
    console.error("クライアントテスト中にエラーが発生しました:", error);
    throw error;
  }
}

// MCPツールテスト
async function testMcpTools(query: AudioQuery) {
  try {
    console.log("\n=== MCPツールテスト ===");

    // VoicevoxClientを一度だけインスタンス化
    const voicevoxClient = new VoicevoxClient({
      url: process.env.VOICEVOX_URL ?? "http://localhost:50021",
      defaultSpeaker: 1,
    });

    // 1. speak ツールテスト
    console.log("\n----- speak ツールのテスト -----");
    const speakHandler = async (args: { text: string; speaker?: number }) => {
      try {
        const { text, speaker } = args;
        const result = await voicevoxClient.enqueueAudioGeneration(
          text,
          speaker
        );
        console.log("speak 結果:", result);
        return {
          content: [{ type: "text", text: result }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("エラーが発生しました:", error);
        return {
          content: [{ type: "text", text: `エラー: ${errorMessage}` }],
        };
      }
    };

    // 実行
    await speakHandler({ text: "MCPツールからのテスト発話です。", speaker: 1 });

    // 2. generate_query ツールテスト
    console.log("\n----- generate_query ツールのテスト -----");
    const generateQueryHandler = async (args: {
      text: string;
      speaker?: number;
    }) => {
      try {
        const { text, speaker } = args;
        const generatedQuery = await voicevoxClient.generateQuery(
          text,
          speaker
        );
        const queryJson = JSON.stringify(generatedQuery);
        console.log(
          "generate_query 結果 (一部):",
          queryJson.substring(0, 100) + "..."
        );
        return {
          content: [{ type: "text", text: queryJson }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("エラーが発生しました:", error);
        return {
          content: [{ type: "text", text: `エラー: ${errorMessage}` }],
        };
      }
    };

    // 実行
    const queryResponse = await generateQueryHandler({
      text: "MCPツールからのクエリ生成テスト。",
      speaker: 1,
    });
    // テキストからJSONに変換
    const generatedQuery = JSON.parse(queryResponse.content[0].text);

    // 3. synthesize_file ツールテスト
    console.log("\n----- synthesize_file ツールのテスト -----");
    const synthesizeFileHandler = async (args: {
      query: AudioQuery;
      output: string;
      speaker?: number;
    }) => {
      try {
        const { query: testQuery, output, speaker } = args;
        const filePath = await voicevoxClient.generateAudioFile(
          testQuery,
          output,
          speaker
        );
        console.log("synthesize_file 結果:", filePath);
        return {
          content: [{ type: "text", text: filePath }],
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.error("エラーが発生しました:", error);
        return {
          content: [{ type: "text", text: `エラー: ${errorMessage}` }],
        };
      }
    };

    // 実行
    const testOutputPath = join(
      tmpdir(),
      `voicevox-mcp-final-test-${Date.now()}.wav`
    );
    await synthesizeFileHandler({
      query: generatedQuery,
      output: testOutputPath,
      speaker: 1,
    });

    // 待機してキューの処理が完了するのを待つ
    console.log("\nMCP音声再生を待機しています...");
    await new Promise((resolve) => setTimeout(resolve, 3000));
  } catch (error) {
    console.error("MCPツールテスト中にエラーが発生しました:", error);
    throw error;
  }
}

// メイン実行関数
async function main() {
  try {
    console.log("VOICEVOXテストを開始します...");

    // クライアントテスト実行
    const query = await testClient();

    // MCPツールテスト実行
    await testMcpTools(query);

    console.log("\nすべてのテストが完了しました！");
  } catch (error) {
    console.error("テスト中にエラーが発生しました:", error);
    process.exit(1);
  }
}

main();
