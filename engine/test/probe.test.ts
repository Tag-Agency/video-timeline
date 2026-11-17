import { expect, test } from "bun:test";
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import { probe, summarize } from "../src/probe.js";
import { makeClip, tmp } from "./fixtures.js";

const dir = tmp();

test("video 25 fps con audio", async () => {
  const info = await probe(makeClip(join(dir, "a.mp4"), { fps: "25", seconds: 2 }));
  expect(info.video?.fps).toEqual({ num: 25, den: 1 });
  expect(info.video?.frames).toBe(50);
  expect(info.video?.width).toBe(320);
  expect(info.video?.vfr).toBe(false);
  expect(info.audio[0]).toMatchObject({ codec: "aac", channels: 2, sampleRate: 48000 });
  expect(summarize(info)).toContain("320x180, 25 fps, h264");
});

test("29.97 resta frazione esatta", async () => {
  const info = await probe(makeClip(join(dir, "b.mov"), { fps: "30000/1001", seconds: 1 }));
  expect(info.video?.fps).toEqual({ num: 30000, den: 1001 });
});

test("rotazione smartphone scambia le dimensioni a schermo", async () => {
  const info = await probe(makeClip(join(dir, "r.mp4"), { size: "320x180", rotate: 90 }));
  expect(Math.abs(info.video!.rotation)).toBe(90);
  expect(info.video?.displayWidth).toBe(180);
  expect(info.video?.displayHeight).toBe(320);
});

test("solo audio", async () => {
  const info = await probe(makeClip(join(dir, "c.m4a"), { video: false }));
  expect(info.video).toBeNull();
  expect(summarize(info)).toContain("solo audio");
});

test("errori leggibili", async () => {
  await expect(probe(join(dir, "manca.mp4"))).rejects.toThrow("File non trovato");
  const bad = join(dir, "bad.mp4");
  writeFileSync(bad, "non è un video");
  await expect(probe(bad)).rejects.toThrow("ffprobe non riesce");
});
