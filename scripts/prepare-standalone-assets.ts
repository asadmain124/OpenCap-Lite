// Copies static assets next to Next's standalone server for local Electron dev.
// electron-builder does this for packaged apps via extraResources; this script
// gives `pnpm electron:dev` the same runtime shape.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const STANDALONE = resolve(ROOT, ".next", "standalone");
const STATIC_SRC = resolve(ROOT, ".next", "static");
const STATIC_DEST = resolve(STANDALONE, ".next", "static");
const PUBLIC_SRC = resolve(ROOT, "public");
const PUBLIC_DEST = resolve(STANDALONE, "public");

function copyDir(src: string, dest: string): void {
  if (!existsSync(src)) return;
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

copyDir(STATIC_SRC, STATIC_DEST);
copyDir(PUBLIC_SRC, PUBLIC_DEST);
console.log("[prepare-standalone-assets] copied .next/static and public");
