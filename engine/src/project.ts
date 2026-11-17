// Cartella progetto e file progetto.silo.json (schema v1).
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, writeFile, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { homedir } from "node:os";
import { probe, type MediaInfo } from "./probe.js";
import { parseRational, type Rational } from "./rational.js";

export const PROJECT_FILE = "progetto.silo.json";
export const SCHEMA = "silo.project/1";

export type Format = "16:9" | "9:16" | "1:1" | "4:5";

export interface Asset {
  id: string;
  name: string;
  /** Percorso relativo alla cartella progetto se il file sta dentro, altrimenti assoluto. */
  path: string;
  /** Hash veloce (dimensione + primo e ultimo MB) per ritrovare file spostati. */
  quickHash: string;
  importedAt: string;
  media: Omit<MediaInfo, "path">;
}

export interface Sequence {
  id: string;
  name: string;
  format: Format;
  width: number;
  height: number;
  fps: Rational;
  tracks: unknown[];
}

export interface Project {
  schema: typeof SCHEMA;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  /** Cresce a ogni operazione: base per live-sync e undo (settimana 2). */
  rev: number;
  assets: Asset[];
  sequences: Sequence[];
  markers: unknown[];
}

export interface OpenProject {
  folder: string;
  project: Project;
}

export function expandPath(p: string, base?: string): string {
  let out = p.trim();
  if (out === "~") out = homedir();
  else if (out.startsWith("~/")) out = join(homedir(), out.slice(2));
  return isAbsolute(out) ? resolve(out) : resolve(base ?? process.cwd(), out);
}

export function assetAbsPath(folder: string, a: Asset): string {
  return isAbsolute(a.path) ? a.path : join(folder, a.path);
}

const FORMAT_SIZE: Record<Format, [number, number]> = {
  "16:9": [1920, 1080],
  "9:16": [1080, 1920],
  "1:1": [1080, 1080],
  "4:5": [1080, 1350],
};

async function quickHash(path: string, size: number): Promise<string> {
  const CHUNK = 1024 * 1024;
  const h = createHash("sha1");
  h.update(String(size));
  const fh = await open(path, "r");
  try {
    const buf = Buffer.alloc(Math.min(CHUNK, size));
    await fh.read(buf, 0, buf.length, 0);
    h.update(buf);
    if (size > CHUNK) {
      const tail = Buffer.alloc(Math.min(CHUNK, size - CHUNK));
      await fh.read(tail, 0, tail.length, size - tail.length);
      h.update(tail);
    }
  } finally {
    await fh.close();
  }
  return h.digest("hex").slice(0, 16);
}

async function saveProject(op: OpenProject): Promise<void> {
  op.project.updatedAt = new Date().toISOString();
  const file = join(op.folder, PROJECT_FILE);
  const tmp = `${file}.tmp-${process.pid}`;
  await writeFile(tmp, JSON.stringify(op.project, null, 2) + "\n", "utf8");
  await rename(tmp, file); // scrittura atomica: niente file a metà se il Mac si spegne
}

export async function createProject(opts: {
  folder: string;
  name?: string;
  fps?: string;
  format?: Format;
  media?: string[];
}): Promise<{ open: OpenProject; imported: Asset[]; errors: string[] }> {
  const folder = expandPath(opts.folder);
  const existing = await stat(join(folder, PROJECT_FILE)).catch(() => null);
  if (existing) throw new Error(`Esiste già un progetto in ${folder}. Usa project_open.`);
  await mkdir(join(folder, "cache"), { recursive: true });
  await mkdir(join(folder, "export"), { recursive: true });

  const now = new Date().toISOString();
  const format = opts.format ?? "16:9";
  const [width, height] = FORMAT_SIZE[format];
  const project: Project = {
    schema: SCHEMA,
    id: randomUUID(),
    name: opts.name?.trim() || basename(folder),
    createdAt: now,
    updatedAt: now,
    rev: 0,
    assets: [],
    sequences: [
      {
        id: "master",
        name: "Master",
        format,
        width,
        height,
        fps: opts.fps ? parseRational(opts.fps) : { num: 25, den: 1 },
        tracks: [],
      },
    ],
    markers: [],
  };
  const op: OpenProject = { folder, project };
  let imported: Asset[] = [];
  let errors: string[] = [];
  if (opts.media?.length) {
    ({ imported, errors } = await importMedia(op, opts.media, { save: false }));
    // Senza fps esplicito la sequenza master prende quello del primo video importato.
    const firstVideo = imported.find((a) => a.media.video);
    if (!opts.fps && firstVideo?.media.video) project.sequences[0].fps = firstVideo.media.video.fps;
  }
  await saveProject(op);
  return { open: op, imported, errors };
}

export async function openProject(folderArg: string): Promise<OpenProject> {
  let folder = expandPath(folderArg);
  if (folder.endsWith(PROJECT_FILE)) folder = resolve(folder, "..");
  let raw: string;
  try {
    raw = await readFile(join(folder, PROJECT_FILE), "utf8");
  } catch {
    throw new Error(`Nessun ${PROJECT_FILE} in ${folder}. Usa project_create per crearne uno.`);
  }
  const project = JSON.parse(raw) as Project;
  if (project.schema !== SCHEMA) {
    throw new Error(`Schema progetto non supportato: ${project.schema} (atteso ${SCHEMA}).`);
  }
  return { folder, project };
}

export async function importMedia(
  op: OpenProject,
  paths: string[],
  { save = true } = {},
): Promise<{ imported: Asset[]; errors: string[] }> {
  const imported: Asset[] = [];
  const errors: string[] = [];
  for (const p of paths) {
    const abs = expandPath(p, op.folder);
    try {
      const info = await probe(abs);
      if (!info.video && info.audio.length === 0) {
        throw new Error("nessuna traccia video o audio");
      }
      const hash = await quickHash(abs, info.sizeBytes);
      const dup = op.project.assets.find((a) => a.quickHash === hash);
      if (dup) {
        errors.push(`${p}: già importato come ${dup.id}`);
        continue;
      }
      const rel = relative(op.folder, abs);
      const { path: _omit, ...media } = info;
      const asset: Asset = {
        id: nextAssetId(op.project),
        name: basename(abs),
        path: rel && !rel.startsWith("..") && !isAbsolute(rel) ? rel : abs,
        quickHash: hash,
        importedAt: new Date().toISOString(),
        media,
      };
      op.project.assets.push(asset);
      imported.push(asset);
    } catch (e) {
      errors.push(`${p}: ${(e as Error).message}`);
    }
  }
  if (imported.length) op.project.rev += 1;
  if (save && imported.length) await saveProject(op);
  return { imported, errors };
}

function nextAssetId(p: Project): string {
  const max = p.assets.reduce((m, a) => Math.max(m, Number(a.id.replace(/^a/, "")) || 0), 0);
  return `a${max + 1}`;
}
