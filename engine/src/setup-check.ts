// Controlla che ffmpeg, whisper e il modello siano pronti su questo Mac.
import { existsSync, statSync } from "node:fs";
import { totalmem, cpus, platform, arch } from "node:os";
import { join } from "node:path";
import { findExecutable } from "./tools-path.js";

export const MODELS = {
  default: "ggml-large-v3-turbo-q5_0.bin",
  fallback: "ggml-medium-q5_0.bin",
} as const;

export function dataDir(): string {
  return process.env.CLAUDE_PLUGIN_DATA || process.env.SILO_DATA_DIR || join(process.env.HOME ?? ".", ".silo");
}

export function modelsDir(): string {
  return join(dataDir(), "models");
}

export interface SetupReport {
  ok: boolean;
  machine: { platform: string; arch: string; cpu: string; ramGB: number };
  tools: Record<string, string | null>;
  models: Record<string, { path: string; present: boolean; sizeMB?: number }>;
  problems: string[];
}

export function setupCheck(): SetupReport {
  const tools = {
    ffmpeg: findExecutable("ffmpeg", "SILO_FFMPEG"),
    ffprobe: findExecutable("ffprobe", "SILO_FFPROBE"),
    "whisper-cli": findExecutable("whisper-cli", "SILO_WHISPER"),
  };
  const models: SetupReport["models"] = {};
  for (const [k, file] of Object.entries(MODELS)) {
    const p = join(modelsDir(), file);
    const present = existsSync(p);
    models[k] = { path: p, present, sizeMB: present ? Math.round(statSync(p).size / 1e6) : undefined };
  }
  const problems: string[] = [];
  for (const [name, p] of Object.entries(tools)) if (!p) problems.push(`${name} mancante`);
  if (!models.default.present && !models.fallback.present) problems.push("nessun modello Whisper scaricato");
  const ramGB = Math.round(totalmem() / 2 ** 30);
  if (platform() === "darwin" && arch() !== "arm64") problems.push("Mac Intel: whisper sarà molto lento");
  return {
    ok: problems.length === 0,
    machine: { platform: platform(), arch: arch(), cpu: cpus()[0]?.model ?? "?", ramGB },
    tools,
    models,
    problems,
  };
}
