import { expect, test } from "bun:test";
import { join } from "node:path";
import { readFileSync, existsSync } from "node:fs";
import { createProject, importMedia, openProject, PROJECT_FILE } from "../src/project.js";
import { makeClip, tmp } from "./fixtures.js";

test("crea, riapre e importa", async () => {
  const media = tmp();
  const clip1 = makeClip(join(media, "intervista.mov"), { fps: "30000/1001", seconds: 2 });
  const clip2 = makeClip(join(media, "broll.mp4"), { seconds: 1 });
  const folder = join(tmp(), "Progetto Rossi");

  const { open, imported, errors } = await createProject({ folder, media: [clip1, join(media, "manca.mp4")] });
  expect(imported).toHaveLength(1);
  expect(errors[0]).toContain("manca.mp4");
  expect(open.project.name).toBe("Progetto Rossi");
  // La master prende il frame rate del primo video.
  expect(open.project.sequences[0].fps).toEqual({ num: 30000, den: 1001 });
  expect(existsSync(join(folder, "cache"))).toBe(true);
  expect(existsSync(join(folder, "export"))).toBe(true);

  await expect(createProject({ folder })).rejects.toThrow("Esiste già");

  const reopened = await openProject(folder);
  expect(reopened.project.assets[0].id).toBe("a1");

  const r = await importMedia(reopened, [clip2, clip1]);
  expect(r.imported.map((a) => a.id)).toEqual(["a2"]);
  expect(r.errors[0]).toContain("già importato");
  const saved = JSON.parse(readFileSync(join(folder, PROJECT_FILE), "utf8"));
  expect(saved.assets).toHaveLength(2);
  expect(saved.rev).toBe(2);
});

test("media dentro la cartella progetto salvati con percorso relativo", async () => {
  const folder = tmp();
  makeClip(join(folder, "girato.mp4"));
  const { open } = await createProject({ folder, media: ["girato.mp4"], fps: "25" });
  expect(open.project.assets[0].path).toBe("girato.mp4");
});

test("errore chiaro se manca il progetto", async () => {
  await expect(openProject(tmp())).rejects.toThrow("project_create");
});
