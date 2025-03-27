#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VoicevoxClient } from "./voicevox/index.js";

const server = new McpServer({
  name: "MCP TTS Voicevox",
  version: "0.0.3",
  description: "Voicevoxで音声を生成します。",
});

// VoicevoxClientを一度だけインスタンス化
const voicevoxClient = new VoicevoxClient({
  url: process.env.VOICEVOX_URL ?? "http://localhost:50021",
  defaultSpeaker: 1,
});

// 共通のエラーハンドリング関数
const handleError = (
  error: unknown
): { content: Array<{ type: "text"; text: string }> } => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("エラーが発生しました:", error);
  return {
    content: [{ type: "text", text: `エラー: ${errorMessage}` }],
  };
};

// テキストを音声に変換して再生
server.tool(
  "speak",
  {
    text: z.string().describe("読み上げるテキスト"),
    speaker: z.number().optional().describe("話者ID"),
  },
  async ({ text, speaker }) => {
    try {
      const result = await voicevoxClient.enqueueAudioGeneration(text, speaker);
      return {
        content: [{ type: "text", text: result }],
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// クエリ生成ツール
server.tool(
  "generate_query",
  {
    text: z.string().describe("音声合成するテキスト"),
    speaker: z.number().optional().describe("話者ID"),
  },
  async ({ text, speaker }) => {
    try {
      const query = await voicevoxClient.generateQuery(text, speaker);
      return {
        content: [{ type: "text", text: JSON.stringify(query) }],
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// 音声ファイル生成ツール - クエリまたはテキストを受け付ける
server.tool(
  "synthesize_file",
  {
    text: z
      .string()
      .optional()
      .describe(
        "音声合成するテキスト（queryパラメータと同時に指定する場合はqueryが優先されます）"
      ),
    query: z.any().optional().describe("音声合成用クエリ"),
    output: z.string().describe("音声ファイルの保存先パス"),
    speaker: z.number().optional().describe("話者ID"),
  },
  async ({ text, query, output, speaker }) => {
    try {
      if (!query && !text) {
        throw new Error(
          "queryパラメータとtextパラメータのどちらかを指定してください"
        );
      }
      const filePath = await voicevoxClient.generateAudioFile(
        query ?? text,
        output,
        speaker
      );

      return {
        content: [{ type: "text", text: filePath }],
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error);
  process.exit(1);
});
