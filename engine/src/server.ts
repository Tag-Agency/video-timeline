// Server MCP del motore silo (stdio). Settimana 1: progetto, import e probe dei media.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { probe, summarize } from "./probe.js";
import {
  createProject,
  expandPath,
  importMedia,
  openProject,
  PROJECT_FILE,
  type Asset,
  type OpenProject,
} from "./project.js";
import { formatRational } from "./rational.js";
import { setupCheck } from "./setup-check.js";

export const VERSION = "0.1.0";

type ToolResult = { content: { type: "text"; text: string }[]; isError?: boolean };

function ok(text: string): ToolResult {
  return { content: [{ type: "text", text }] };
}

function fail(e: unknown): ToolResult {
  return { content: [{ type: "text", text: `Errore: ${(e as Error).message ?? String(e)}` }], isError: true };
}

function wrap<A>(fn: (args: A) => Promise<string>) {
  return async (args: A): Promise<ToolResult> => {
    try {
      return ok(await fn(args));
    } catch (e) {
      return fail(e);
    }
  };
}

function assetLine(a: Asset): string {
  return `${a.id} ${a.name}: ${summarize({ path: a.path, ...a.media })}`;
}

/** Riassunto compatto del progetto: Claude riceve id e numeri, non il JSON intero. */
export function projectSummary(op: OpenProject): string {
  const p = op.project;
  const seq = p.sequences
    .map((s) => `${s.id} (${s.format} ${s.width}x${s.height} @ ${formatRational(s.fps)} fps, ${s.tracks.length} tracce)`)
    .join("; ");
  const totalSec = p.assets.reduce((t, a) => t + a.media.durationSec, 0);
  const lines = [
    `Progetto "${p.name}" in ${op.folder} (rev ${p.rev})`,
    `Sequenze: ${seq}`,
    `Media: ${p.assets.length} file, ${(totalSec / 60).toFixed(1)} min totali`,
    ...p.assets.slice(0, 50).map((a) => `  ${assetLine(a)}`),
  ];
  if (p.assets.length > 50) lines.push(`  … altri ${p.assets.length - 50}`);
  const vfr = p.assets.filter((a) => a.media.video?.vfr);
  if (vfr.length) lines.push(`Attenzione: frame rate variabile in ${vfr.map((a) => a.id).join(", ")}`);
  return lines.join("\n");
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "silo", version: VERSION });
  let current: OpenProject | null = null;

  const requireProject = (): OpenProject => {
    if (!current) throw new Error("Nessun progetto aperto. Usa project_open o project_create.");
    return current;
  };

  server.registerTool(
    "project_create",
    {
      title: "Crea progetto",
      description:
        `Crea una cartella progetto (${PROJECT_FILE}, cache/, export/) e importa i media indicati. ` +
        "Il progetto creato diventa quello aperto. I media originali non vengono copiati né modificati.",
      inputSchema: {
        folder: z.string().describe("Cartella del progetto, es. ~/Progetti/Intervista-Rossi"),
        name: z.string().optional().describe("Nome leggibile; default = nome della cartella"),
        media: z.array(z.string()).optional().describe("File video/audio da importare"),
        fps: z.string().optional().describe('Frame rate della sequenza, es. "25" o "30000/1001"; default = quello del primo video'),
        format: z.enum(["16:9", "9:16", "1:1", "4:5"]).optional().describe("Formato della sequenza master; default 16:9"),
      },
    },
    wrap(async (args) => {
      const { open, errors } = await createProject(args);
      current = open;
      return [projectSummary(open), ...errors.map((e) => `Non importato: ${e}`)].join("\n");
    }),
  );

  server.registerTool(
    "project_open",
    {
      title: "Apri progetto",
      description: `Apre un progetto esistente (cartella con ${PROJECT_FILE}) e ne restituisce un riassunto.`,
      inputSchema: { folder: z.string().describe("Cartella del progetto") },
    },
    wrap(async ({ folder }) => {
      current = await openProject(folder);
      return projectSummary(current);
    }),
  );

  server.registerTool(
    "project_import",
    {
      title: "Importa media",
      description: "Importa altri file video/audio nel progetto aperto (per riferimento, senza copiarli).",
      inputSchema: { media: z.array(z.string()).min(1).describe("File da importare") },
    },
    wrap(async ({ media }) => {
      const op = requireProject();
      const { imported, errors } = await importMedia(op, media);
      return [
        `Importati ${imported.length} file (rev ${op.project.rev}).`,
        ...imported.map((a) => `  ${assetLine(a)}`),
        ...errors.map((e) => `Non importato: ${e}`),
      ].join("\n");
    }),
  );

  server.registerTool(
    "project_info",
    {
      title: "Stato progetto",
      description: "Riassunto del progetto aperto: sequenze e media con id.",
      inputSchema: {},
    },
    wrap(async () => projectSummary(requireProject())),
  );

  server.registerTool(
    "media_probe",
    {
      title: "Analizza file media",
      description:
        "Durata, fps (come frazione esatta), risoluzione, rotazione, codec e tracce audio di un file. " +
        "Segnala i file a frame rate variabile (VFR), tipici degli smartphone.",
      inputSchema: {
        path: z.string().describe("Percorso del file"),
        details: z.boolean().optional().describe("true = JSON completo invece del riassunto di una riga"),
      },
    },
    wrap(async ({ path, details }) => {
      const info = await probe(expandPath(path, current?.folder));
      return details ? JSON.stringify(info, null, 2) : summarize(info);
    }),
  );

  server.registerTool(
    "setup_check",
    {
      title: "Controllo installazione",
      description:
        "Verifica su questo Mac ffmpeg, ffprobe, whisper-cli e i modelli Whisper. Se qualcosa manca, " +
        "indica di lanciare scripts/setup.sh del plugin.",
      inputSchema: {},
    },
    wrap(async () => JSON.stringify(setupCheck(), null, 2)),
  );

  return server;
}
