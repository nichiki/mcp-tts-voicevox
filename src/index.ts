#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VoicevoxClient } from "./voicevox/index.js";

const server = new McpServer({
  name: "MCP TTS Voicevox",
  version: "0.0.2",
  description: "Voicevoxで音声を生成します。",
});

server.tool(
  "speak",
  { text: z.string(), speaker: z.number().optional() },
  async ({ text, speaker }) => {
    const voicevoxClient = new VoicevoxClient({
      url: process.env.VOICEVOX_URL ?? "http://localhost:50021",
      defaultSpeaker: 1,
    });

    const result = await voicevoxClient.speak(text, speaker);
    return {
      content: [{ type: "text", text: result }],
    };
  }
);

server.connect(new StdioServerTransport()).catch(console.error);
