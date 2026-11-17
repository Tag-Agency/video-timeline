// Tempi e frame rate come frazioni esatte (es. 30000/1001), mai float.

export interface Rational {
  num: number;
  den: number;
}

function gcd(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a || 1;
}

export function rational(num: number, den = 1): Rational {
  if (!Number.isInteger(num) || !Number.isInteger(den) || den === 0) {
    throw new Error(`Frazione non valida: ${num}/${den}`);
  }
  const g = gcd(num, den);
  const sign = den < 0 ? -1 : 1;
  return { num: (sign * num) / g, den: (sign * den) / g };
}

/** Accetta "25", "30000/1001", "29.97", "23.976". */
export function parseRational(s: string): Rational {
  const t = s.trim();
  if (t.includes("/")) {
    const [n, d] = t.split("/").map(Number);
    return rational(n, d);
  }
  const v = Number(t);
  if (!Number.isFinite(v) || v <= 0) throw new Error(`Frame rate non valido: ${s}`);
  // Frame rate NTSC comuni scritti come decimali.
  const ntsc: Record<string, Rational> = {
    "23.976": rational(24000, 1001),
    "23.98": rational(24000, 1001),
    "29.97": rational(30000, 1001),
    "59.94": rational(60000, 1001),
  };
  if (ntsc[t]) return ntsc[t];
  if (Number.isInteger(v)) return rational(v, 1);
  return rational(Math.round(v * 1000), 1000);
}

export function toNumber(r: Rational): number {
  return r.num / r.den;
}

export function formatRational(r: Rational): string {
  return r.den === 1 ? String(r.num) : `${r.num}/${r.den}`;
}

/** Numero di frame interi (arrotondati) in una durata in secondi a un dato fps. */
export function secondsToFrames(seconds: number, fps: Rational): number {
  return Math.round((seconds * fps.num) / fps.den);
}

/** Secondi esatti all'inizio del frame n. */
export function framesToSeconds(frames: number, fps: Rational): number {
  return (frames * fps.den) / fps.num;
}

/** Timecode HH:MM:SS:FF (non drop-frame). */
export function framesToTimecode(frames: number, fps: Rational): string {
  const base = Math.round(toNumber(fps));
  const ff = frames % base;
  const totalSec = Math.floor(frames / base);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(totalSec / 3600))}:${pad(Math.floor(totalSec / 60) % 60)}:${pad(totalSec % 60)}:${pad(ff)}`;
}
