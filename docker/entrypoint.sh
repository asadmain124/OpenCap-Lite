#!/bin/sh
# Container entrypoint — applies pending Prisma migrations, seeds the
# demo company on first boot, then starts the Next.js standalone server.

set -e

echo "[entrypoint] applying Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

# Seed only if the DB has no companies. The seed itself is idempotent
# (it clears prior Acme rows before re-inserting) but we want to leave
# user-imported data alone.
echo "[entrypoint] checking for existing data..."
COMPANY_COUNT=$(node -e "
const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  try {
    const n = await p.company.count();
    process.stdout.write(String(n));
  } finally {
    await p.\$disconnect();
  }
})();
")

if [ "$COMPANY_COUNT" = "0" ]; then
  echo "[entrypoint] empty database — seeding Acme Labs demo..."
  node node_modules/.bin/tsx prisma/seed.ts
else
  echo "[entrypoint] $COMPANY_COUNT companies present — skipping seed."
fi

echo "[entrypoint] starting Next.js..."
exec node server.js
