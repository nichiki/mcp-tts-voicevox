#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VoicevoxClient } from "./voicevox/index.js";

const server = new McpServer({
  name: "MCP TTS Voicevox",
  version: "0.0.4",
  description:
    "A Voicevox server that converts text to speech for playback and saving.",
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
  "Convert text to speech and play it",
  {
    text: z.string().describe("Text to be spoken"),
    speaker: z.number().optional().describe("Speaker ID (optional)"),
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
  "Generate a query for voice synthesis",
  {
    text: z.string().describe("Text for voice synthesis"),
    speaker: z.number().optional().describe("Speaker ID (optional)"),
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
  "Generate an audio file and return its absolute path",
  {
    text: z
      .string()
      .optional()
      .describe(
        "Text for voice synthesis (if both query and text are provided, query takes precedence)"
      ),
    query: z.any().optional().describe("Voice synthesis query"),
    output: z.string().describe("Output path for the audio file"),
    speaker: z.number().optional().describe("Speaker ID (optional)"),
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
