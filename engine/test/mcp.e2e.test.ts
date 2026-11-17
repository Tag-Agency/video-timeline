// End-to-end: avvia il plugin come farebbe Claude Code (launcher + bundle) e parla MCP via stdio.
// Richiede `npm run build` prima.
import { afterAll, beforeAll, expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { makeClip, tmp } from "./fixtures.js";

const pluginRoot = resolve(import.meta.dir, "../../plugins/silo");
const client = new Client({ name: "test", version: "0" });

const text = (r: unknown) => ((r as { content: { text: string }[] }).content[0]?.text ?? "");

beforeAll(async () => {
  if (!existsSync(join(pluginRoot, "server/engine.mjs"))) throw new Error("Esegui prima npm run build");
  await client.connect(
    new StdioClientTransport({
      command: "sh",
      args: [join(pluginRoot, "server/silo-engine")],
      env: { ...(process.env as Record<string, string>), CLAUDE_PLUGIN_ROOT: pluginRoot, CLAUDE_PLUGIN_DATA: tmp() },
    }),
  );
});

afterAll(async () => {
  await client.close();
});

test("espone i tool della settimana 1", async () => {
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name).sort()).toEqual(
    ["media_probe", "project_create", "project_import", "project_info", "project_open", "setup_check"],
  );
});

test("flusso progetto completo", async () => {
  const media = tmp();
  const clip = makeClip(join(media, "intervista.mp4"), { fps: "25", seconds: 2 });
  const folder = join(tmp(), "Demo");

  const noProj = await client.callTool({ name: "project_info", arguments: {} });
  expect(noProj.isError).toBe(true);

  const created = await client.callTool({ name: "project_create", arguments: { folder, media: [clip] } });
  expect(created.isError).toBeFalsy();
  expect(text(created)).toContain('Progetto "Demo"');
  expect(text(created)).toContain("a1 intervista.mp4: 2.00s, 320x180, 25 fps");

  const probe = await client.callTool({ name: "media_probe", arguments: { path: clip, details: true } });
  expect(JSON.parse(text(probe)).video.fps).toEqual({ num: 25, den: 1 });

  const opened = await client.callTool({ name: "project_open", arguments: { folder } });
  expect(text(opened)).toContain("Media: 1 file");

  const bad = await client.callTool({ name: "media_probe", arguments: { path: "/non/esiste.mov" } });
  expect(bad.isError).toBe(true);
  expect(text(bad)).toContain("File non trovato");

  const setup = JSON.parse(text(await client.callTool({ name: "setup_check", arguments: {} })));
  expect(setup.tools.ffprobe).toBeTruthy();
});
