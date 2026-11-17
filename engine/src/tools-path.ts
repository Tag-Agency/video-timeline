// Trova gli eseguibili esterni. Claude Code avviato dall'app Desktop spesso non ha
// /opt/homebrew/bin nel PATH, quindi lo aggiungiamo noi.
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";

const EXTRA_DIRS = ["/opt/homebrew/bin", "/usr/local/bin"];

export function findExecutable(name: string, envVar?: string): string | null {
  const override = envVar ? process.env[envVar] : undefined;
  if (override && existsSync(override)) return override;
  const dirs = [...(process.env.PATH ?? "").split(delimiter), ...EXTRA_DIRS];
  for (const dir of dirs) {
    if (!dir) continue;
    const p = join(dir, name);
    if (existsSync(p)) return p;
  }
  return null;
}

export function requireExecutable(name: string, envVar?: string): string {
  const p = findExecutable(name, envVar);
  if (!p) {
    throw new Error(
      `${name} non trovato. Esegui il setup del plugin (skill "setup" o scripts/setup.sh) per installarlo.`,
    );
  }
  return p;
}
