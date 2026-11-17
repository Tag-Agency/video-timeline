import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function tmp(prefix = "vt-test-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** Genera clip di prova brevi con ffmpeg (barre colore + tono). */
export function makeClip(path: string, opts: { fps?: string; size?: string; seconds?: number; audio?: boolean; video?: boolean; rotate?: number } = {}): string {
  const { fps = "25", size = "320x180", seconds = 2, audio = true, video = true } = opts;
  const args = ["-v", "error", "-y"];
  if (video) args.push("-f", "lavfi", "-i", `testsrc2=size=${size}:rate=${fps}:duration=${seconds}`);
  if (audio) args.push("-f", "lavfi", "-i", `sine=frequency=440:sample_rate=48000:duration=${seconds}`);
  if (video) args.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast");
  if (audio) args.push("-c:a", "aac", "-ac", "2");
  if (opts.rotate === undefined) {
    execFileSync("ffmpeg", [...args, path]);
    return path;
  }
  // La rotazione (come nei video da smartphone) si applica in un remux senza ricodifica.
  const raw = `${path}.raw.mp4`;
  execFileSync("ffmpeg", [...args, raw]);
  execFileSync("ffmpeg", ["-v", "error", "-y", "-display_rotation", String(opts.rotate), "-i", raw, "-c", "copy", path]);
  return path;
}
