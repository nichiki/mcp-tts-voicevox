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

/**
 * VOICEVOX音声合成クライアントを初期化します
 * @param config 設定オブジェクト
 * @returns VoicevoxClientのインスタンス
 */
export function initVoicevox(config: VoicevoxConfig): VoicevoxClient {
  return new VoicevoxClient(config);
}

// デフォルトのVOICEVOXクライアント
const voicevoxClient = initVoicevox({
  url: process.env.VOICEVOX_URL || "http://localhost:50021",
  defaultSpeaker: Number(process.env.VOICEVOX_DEFAULT_SPEAKER || "1"),
  defaultSpeedScale: Number(process.env.VOICEVOX_DEFAULT_SPEED_SCALE || "1.0"),
});

const server = new McpServer({
  name: "MCP TTS Voicevox",
  version: "0.0.5",
  description:
    "A Voicevox server that converts text to speech for playback and saving.",
  functions: {
    // 既存の関数
    speak: {
      parameters: z.object({
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
      }),
      handler: async ({
        text,
        speaker,
        query,
        speedScale,
      }: {
        text: string;
        speaker?: number;
        query?: string;
        speedScale?: number;
      }) => {
        try {
          if (query) {
            // クエリが提供されている場合はそれを使用
            const audioQuery = JSON.parse(query) as AudioQuery;
            if (speedScale !== undefined) {
              audioQuery.speedScale = speedScale;
            }
            return await voicevoxClient.enqueueAudioGeneration(
              audioQuery,
              speaker
            );
          } else {
            // テキストからの通常の発話
            return await voicevoxClient.speak(text, speaker, speedScale);
          }
        } catch (error) {
          console.error("VOICEVOX speak error:", error);
          return `Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      },
    },
    generate_query: {
      parameters: z.object({
        text: z.string().describe("Text for voice synthesis"),
        speaker: z.number().optional().describe("Speaker ID (optional)"),
        speedScale: z
          .number()
          .optional()
          .describe(
            "Playback speed (optional, default is from environment variable)"
          ),
      }),
      handler: async ({
        text,
        speaker,
        speedScale,
      }: {
        text: string;
        speaker?: number;
        speedScale?: number;
      }) => {
        try {
          const query = await voicevoxClient.generateQuery(
            text,
            speaker,
            speedScale
          );
          return JSON.stringify(query);
        } catch (error) {
          console.error("VOICEVOX generate query error:", error);
          return `Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      },
    },
    synthesize_file: {
      parameters: z.object({
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
      }),
      handler: async ({
        text,
        query,
        speaker,
        output,
        speedScale,
      }: {
        text?: string;
        query?: string;
        speaker?: number;
        output: string;
        speedScale?: number;
      }) => {
        try {
          if (query) {
            // クエリが提供されている場合はそれを使用
            const audioQuery = JSON.parse(query) as AudioQuery;
            if (speedScale !== undefined) {
              audioQuery.speedScale = speedScale;
            }
            return await voicevoxClient.generateAudioFile(
              audioQuery,
              output,
              speaker
            );
          } else if (text) {
            // テキストから音声ファイルを生成
            return await voicevoxClient.generateAudioFile(
              text,
              output,
              speaker,
              speedScale
            );
          } else {
            return "Error: Either text or query must be provided";
          }
        } catch (error) {
          console.error("VOICEVOX synthesize file error:", error);
          return `Error: ${
            error instanceof Error ? error.message : String(error)
          }`;
        }
      },
    },
  },
});

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
