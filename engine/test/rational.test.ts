import { expect, test } from "bun:test";
import { parseRational, formatRational, secondsToFrames, framesToSeconds, framesToTimecode } from "../src/rational.js";

test("parse frame rate comuni", () => {
  expect(parseRational("25")).toEqual({ num: 25, den: 1 });
  expect(parseRational("30000/1001")).toEqual({ num: 30000, den: 1001 });
  expect(parseRational("29.97")).toEqual({ num: 30000, den: 1001 });
  expect(parseRational("50/2")).toEqual({ num: 25, den: 1 });
  expect(() => parseRational("abc")).toThrow();
});

test("conversioni frame/secondi senza deriva", () => {
  const ntsc = parseRational("30000/1001");
  expect(formatRational(ntsc)).toBe("30000/1001");
  const oneHour = secondsToFrames(3600, ntsc);
  expect(oneHour).toBe(107892);
  expect(secondsToFrames(framesToSeconds(oneHour, ntsc), ntsc)).toBe(oneHour);
  expect(framesToTimecode(25 * 61 + 3, parseRational("25"))).toBe("00:01:01:03");
});
