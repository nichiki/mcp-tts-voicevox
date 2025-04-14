#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VoicevoxClient } from "./voicevox";
import {
  AudioQuery,
  VoicevoxConfig,
  VoicevoxError,
  Score,
  Note,
  FrameAudioQuery,
} from "./voicevox/types";

const server = new McpServer({
  name: "MCP TTS Voicevox",
  version: "0.0.7",
  description:
    "A Voicevox server that converts text to speech for playback and saving.",
});

// VoicevoxClientを一度だけインスタンス化
const voicevoxClient = new VoicevoxClient({
  url: process.env.VOICEVOX_URL ?? "http://localhost:50021",
  defaultSpeaker: Number(process.env.VOICEVOX_DEFAULT_SPEAKER || "1"),
  defaultSpeedScale: Number(process.env.VOICEVOX_DEFAULT_SPEED_SCALE || "1.0"),
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
    text: z
      .string()
      .describe(
        "Text to be spoken (if both query and text are provided, query takes precedence)"
      ),
    speaker: z
      .number()
      .optional()
      .describe("Speaker ID (optional, used if text is provided)"),
    query: z.string().optional().describe("Voice synthesis query"),
    speedScale: z
      .number()
      .optional()
      .describe(
        "Playback speed (optional, default is from environment variable)"
      ),
  },
  async ({ text, speaker, query, speedScale }) => {
    try {
      if (query) {
        // クエリが提供されている場合はそれを使用
        const audioQuery = JSON.parse(query) as AudioQuery;
        if (speedScale !== undefined) {
          audioQuery.speedScale = speedScale;
        }
        const result = await voicevoxClient.enqueueAudioGeneration(
          audioQuery,
          speaker
        );
        return {
          content: [{ type: "text", text: result }],
        };
      } else {
        // テキストからの通常の発話
        const result = await voicevoxClient.speak(text, speaker, speedScale);
        return {
          content: [{ type: "text", text: result }],
        };
      }
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
    speedScale: z
      .number()
      .optional()
      .describe(
        "Playback speed (optional, default is from environment variable)"
      ),
  },
  async ({ text, speaker, speedScale }) => {
    try {
      const query = await voicevoxClient.generateQuery(
        text,
        speaker,
        speedScale
      );
      return {
        content: [{ type: "text", text: JSON.stringify(query) }],
      };
    } catch (error) {
      return handleError(error);
    }
  }
);

// 音声ファイル生成ツール
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
    query: z.string().optional().describe("Voice synthesis query"),
    speaker: z.number().optional().describe("Speaker ID (optional)"),
    output: z.string().describe("Output path for the audio file"),
    speedScale: z
      .number()
      .optional()
      .describe(
        "Playback speed (optional, default is from environment variable)"
      ),
  },
  async ({ text, query, speaker, output, speedScale }) => {
    try {
      if (query) {
        // クエリが提供されている場合はそれを使用
        const audioQuery = JSON.parse(query) as AudioQuery;
        if (speedScale !== undefined) {
          audioQuery.speedScale = speedScale;
        }
        const filePath = await voicevoxClient.generateAudioFile(
          audioQuery,
          output,
          speaker
        );
        return {
          content: [{ type: "text", text: filePath }],
        };
      } else if (text) {
        // テキストから音声ファイルを生成
        const filePath = await voicevoxClient.generateAudioFile(
          text,
          output,
          speaker,
          speedScale
        );
        return {
          content: [{ type: "text", text: filePath }],
        };
      } else {
        throw new Error(
          "queryパラメータとtextパラメータのどちらかを指定してください"
        );
      }
    } catch (error) {
      return handleError(error);
    }
  }
);

server.connect(new StdioServerTransport()).catch((error) => {
  console.error("Error connecting to MCP transport:", error);
  process.exit(1);
});

// 型定義のエクスポート（モジュールとして使用する場合）
export {
  AudioQuery,
  VoicevoxConfig,
  VoicevoxError,
  Score,
  Note,
  FrameAudioQuery,
};
