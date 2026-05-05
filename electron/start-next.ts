// Boots the Next.js standalone server in-process and resolves to the
// http URL once it's ready. Used by the Electron main process.

import { createServer } from "node:net";
import { resolve } from "node:path";

export interface StartedNext {
  url: string;
  port: number;
  shutdown: () => Promise<void>;
}

function pickFreePort(): Promise<number> {
  return new Promise((resolveP, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") {
        srv.close();
        reject(new Error("could not determine port"));
        return;
      }
      const { port } = addr;
      srv.close(() => resolveP(port));
    });
  });
}

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`Next.js standalone server did not start at ${url}`);
}

export async function startNextServer(opts: {
  standaloneDir: string;
}): Promise<StartedNext> {
  const port = await pickFreePort();
  process.env.PORT = String(port);
  process.env.HOSTNAME = "127.0.0.1";

  // Next's standalone server.js immediately calls .listen() on require,
  // so we change CWD first so its relative paths resolve correctly.
  const prevCwd = process.cwd();
  process.chdir(opts.standaloneDir);
  try {
    require(resolve(opts.standaloneDir, "server.js"));
  } finally {
    process.chdir(prevCwd);
  }

  const url = `http://127.0.0.1:${port}`;
  await waitFor(`${url}/api/health`, 15_000);

  return {
    url,
    port,
    shutdown: async () => {
      // Next's standalone server doesn't expose a clean shutdown handle;
      // when the Electron app quits, the process tree is torn down.
    },
  };
}
