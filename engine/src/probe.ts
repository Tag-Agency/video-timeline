// media_probe: legge durata, fps, risoluzione e tracce audio con ffprobe.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { stat } from "node:fs/promises";
import { parseRational, formatRational, secondsToFrames, toNumber, type Rational } from "./rational.js";
import { requireExecutable } from "./tools-path.js";

const execFileP = promisify(execFile);

export interface VideoStreamInfo {
  index: number;
  codec: string;
  width: number;
  height: number;
  /** Larghezza/altezza come appaiono a schermo, con rotazione applicata. */
  displayWidth: number;
  displayHeight: number;
  rotation: number;
  fps: Rational;
  frames: number;
  pixFmt?: string;
  vfr: boolean;
}

export interface AudioStreamInfo {
  index: number;
  codec: string;
  channels: number;
  sampleRate: number;
  layout?: string;
  language?: string;
}

export interface MediaInfo {
  path: string;
  sizeBytes: number;
  container: string;
  durationSec: number;
  video: VideoStreamInfo | null;
  audio: AudioStreamInfo[];
  timecode?: string;
  creationTime?: string;
}

interface FfStream {
  index: number;
  codec_type: string;
  codec_name?: string;
  width?: number;
  height?: number;
  r_frame_rate?: string;
  avg_frame_rate?: string;
  nb_frames?: string;
  duration?: string;
  pix_fmt?: string;
  channels?: number;
  sample_rate?: string;
  channel_layout?: string;
  tags?: Record<string, string>;
  side_data_list?: Array<{ rotation?: number }>;
  disposition?: { attached_pic?: number };
}

function validRate(s?: string): Rational | null {
  if (!s || s === "0/0") return null;
  try {
    const r = parseRational(s);
    return r.num > 0 ? r : null;
  } catch {
    return null;
  }
}

export async function probe(path: string): Promise<MediaInfo> {
  const ffprobe = requireExecutable("ffprobe", "VT_FFPROBE");
  const st = await stat(path).catch(() => {
    throw new Error(`File non trovato: ${path}`);
  });
  if (!st.isFile()) throw new Error(`Non è un file: ${path}`);

  let stdout: string;
  try {
    ({ stdout } = await execFileP(
      ffprobe,
      ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
      { maxBuffer: 16 * 1024 * 1024 },
    ));
  } catch (e) {
    const msg = (e as { stderr?: string }).stderr?.trim() || String(e);
    throw new Error(`ffprobe non riesce a leggere ${path}: ${msg}`);
  }
  const data = JSON.parse(stdout) as {
    streams?: FfStream[];
    format?: { format_name?: string; duration?: string; tags?: Record<string, string> };
  };
  const streams = data.streams ?? [];
  const durationSec = Number(data.format?.duration ?? 0) || 0;

  const v = streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  let video: VideoStreamInfo | null = null;
  if (v) {
    const r = validRate(v.r_frame_rate);
    const avg = validRate(v.avg_frame_rate);
    const fps = avg ?? r ?? { num: 25, den: 1 };
    // Se r_frame_rate e avg_frame_rate differiscono di molto il file è a frame rate variabile
    // (tipico degli smartphone): andrà conformato prima del montaggio.
    const vfr = !!(r && avg && Math.abs(toNumber(r) - toNumber(avg)) / toNumber(avg) > 0.01);
    const rotation =
      Number(v.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? v.tags?.rotate ?? 0) || 0;
    const rotated = Math.abs(rotation) % 180 === 90;
    const w = v.width ?? 0;
    const h = v.height ?? 0;
    const vDur = Number(v.duration ?? durationSec) || durationSec;
    video = {
      index: v.index,
      codec: v.codec_name ?? "unknown",
      width: w,
      height: h,
      displayWidth: rotated ? h : w,
      displayHeight: rotated ? w : h,
      rotation,
      fps,
      frames: Number(v.nb_frames) || secondsToFrames(vDur, fps),
      pixFmt: v.pix_fmt,
      vfr,
    };
  }

  const audio: AudioStreamInfo[] = streams
    .filter((s) => s.codec_type === "audio")
    .map((s) => ({
      index: s.index,
      codec: s.codec_name ?? "unknown",
      channels: s.channels ?? 0,
      sampleRate: Number(s.sample_rate) || 0,
      layout: s.channel_layout,
      language: s.tags?.language,
    }));

  const timecode =
    data.format?.tags?.timecode ?? streams.find((s) => s.tags?.timecode)?.tags?.timecode;

  return {
    path,
    sizeBytes: st.size,
    container: data.format?.format_name ?? "unknown",
    durationSec,
    video,
    audio,
    timecode,
    creationTime: data.format?.tags?.creation_time,
  };
}

/** Riassunto di una riga, per risposte compatte a Claude. */
export function summarize(m: MediaInfo): string {
  const parts = [`${m.durationSec.toFixed(2)}s`];
  if (m.video) {
    const v = m.video;
    parts.push(
      `${v.displayWidth}x${v.displayHeight}`,
      `${formatRational(v.fps)} fps${v.vfr ? " (VFR)" : ""}`,
      v.codec,
    );
  } else {
    parts.push("solo audio");
  }
  if (m.audio.length) {
    parts.push(
      m.audio.map((a) => `${a.codec} ${a.channels}ch ${Math.round(a.sampleRate / 1000)}kHz`).join(" + "),
    );
  } else {
    parts.push("senza audio");
  }
  return parts.join(", ");
}
