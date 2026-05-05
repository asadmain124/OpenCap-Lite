// Builds prisma/sqlite/template.db — a fresh SQLite database with all
// migrations applied and the Acme demo seeded. The Electron desktop app
// copies this file into the user's app-data directory on first launch.

import { closeSync, existsSync, openSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(__dirname, "..");
const TEMPLATE = resolve(ROOT, "prisma", "sqlite", "template.db");
const SQLITE_SCHEMA = "prisma/sqlite/schema.prisma";

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv): void {
  const result = spawnSync(cmd, args, { stdio: "inherit", cwd: ROOT, env });
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} exited with ${result.status}`);
  }
}

function main(): void {
  if (existsSync(TEMPLATE)) unlinkSync(TEMPLATE);
  closeSync(openSync(TEMPLATE, "w"));

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: `file:${TEMPLATE}`,
  };

  run("pnpm", ["exec", "prisma", "migrate", "deploy", `--schema=${SQLITE_SCHEMA}`], env);
  run("pnpm", ["exec", "tsx", "prisma/seed.ts"], env);

  console.log(`[build-template-db] wrote ${TEMPLATE}`);
}

main();
