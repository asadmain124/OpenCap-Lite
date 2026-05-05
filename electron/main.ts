// Electron main process for OpenCap Lite desktop.
//
// Startup:
//   1. Compute the SQLite path inside app.getPath('userData').
//   2. If no DB exists yet, copy the bundled template.db (pre-migrated +
//      pre-seeded with the Acme demo) into place.
//   3. Boot the Next.js standalone server on a random localhost port,
//      with DATABASE_URL pointing at the SQLite file.
//   4. Open a BrowserWindow loading that URL.
//
// Schema upgrades after v1 will need a migration runner — see
// docs/DESKTOP.md once that lands.

import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { app, BrowserWindow, dialog, shell } from "electron";

import { startNextServer } from "./start-next";

const isDev = !app.isPackaged;

// Resource paths differ between dev (running from repo) and packaged
// (running inside the .app bundle). electron-builder copies extraResources
// into process.resourcesPath.
function resolveResource(rel: string): string {
  if (isDev) {
    return join(__dirname, "..", "..", rel);
  }
  return join(process.resourcesPath, rel);
}

function ensureUserDb(): string {
  const userDataDir = app.getPath("userData");
  mkdirSync(userDataDir, { recursive: true });
  const dbPath = join(userDataDir, "opencap.db");
  if (!existsSync(dbPath)) {
    const template = resolveResource("prisma/sqlite/template.db");
    if (!existsSync(template)) {
      throw new Error(
        `template.db not found at ${template}. Run \`pnpm desktop:build\` first.`,
      );
    }
    copyFileSync(template, dbPath);
  }
  return dbPath;
}

function createWindow(url: string): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 600,
    title: "OpenCap Lite",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(url);

  win.webContents.setWindowOpenHandler(({ url: target }) => {
    if (!target.startsWith(url)) {
      shell.openExternal(target);
      return { action: "deny" };
    }
    return { action: "allow" };
  });
}

async function main(): Promise<void> {
  await app.whenReady();

  try {
    const dbPath = ensureUserDb();
    process.env.DATABASE_URL = `file:${dbPath}`;

    const standaloneDir = isDev
      ? resolveResource(".next/standalone")
      : resolveResource("app/.next/standalone");

    if (!existsSync(join(standaloneDir, "server.js"))) {
      throw new Error(
        `Next.js standalone build not found at ${standaloneDir}. Run \`pnpm desktop:build\` before \`pnpm electron:dev\`.`,
      );
    }

    const { url } = await startNextServer({ standaloneDir });
    createWindow(url);
  } catch (err) {
    console.error("Failed to start OpenCap Lite:", err);
    dialog.showErrorBox("OpenCap Lite — Startup Error", String(err));
    app.exit(1);
  }
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void main();
  }
});

void main();
