// Generates prisma/schema.sqlite.prisma from prisma/schema.prisma.
//
// SQLite via Prisma does not support enum types or @db.* native types, so
// the desktop build needs a parallel schema where:
//   - enums are stripped and their fields become `String`
//   - @default(ENUM_VALUE) literals become @default("ENUM_VALUE")
//   - @db.Decimal(...) / other native-type modifiers are dropped
//   - the datasource provider is "sqlite"
//
// Run via `pnpm db:sync:sqlite`. CI re-runs the script and `git diff
// --exit-code` enforces that the generated file is committed.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ROOT = resolve(__dirname, "..");
const SOURCE = resolve(ROOT, "prisma", "schema.prisma");
const TARGET = resolve(ROOT, "prisma", "sqlite", "schema.prisma");

const HEADER = `// AUTO-GENERATED from prisma/schema.prisma by scripts/sync-sqlite-schema.ts.
// Do not edit by hand. Run \`pnpm db:sync:sqlite\` to regenerate.
//
// SQLite is used for the Electron desktop build only. The Postgres schema
// remains the source of truth; this file mirrors it with enums collapsed
// to String and native-type modifiers stripped.
`;

function generate(input: string): string {
  // 1. Capture every `enum Foo { ... }` block — both names and values.
  const enumNames = new Set<string>();
  const enumValues = new Set<string>();
  let out = input.replace(/enum\s+(\w+)\s*\{([^}]*)\}\s*/g, (_match, name: string, body: string) => {
    enumNames.add(name);
    for (const line of body.split("\n")) {
      const value = line.trim();
      if (value && !value.startsWith("//")) enumValues.add(value);
    }
    return "";
  });

  // 2. Walk lines: rewrite enum-typed field declarations and quote enum
  //    defaults. A field line looks like:
  //      <indent><name><gap><type><optional?><rest>
  out = out
    .split("\n")
    .map((line) => {
      const fieldMatch = line.match(/^(\s+)(\w+)(\s+)(\w+)(\??)(.*)$/);
      if (!fieldMatch) return line;
      let [, indent, fieldName, gap, typeName, optional, rest] = fieldMatch;

      if (enumNames.has(typeName)) {
        typeName = "String";
      }

      // Quote any @default(IDENT) where IDENT is an enum value.
      rest = rest.replace(/@default\(([A-Z][A-Z0-9_]*)\)/g, (m, ident: string) => {
        if (enumValues.has(ident)) return `@default("${ident}")`;
        return m;
      });

      return `${indent}${fieldName}${gap}${typeName}${optional}${rest}`;
    })
    .join("\n");

  // 3. Strip @db.* native-type modifiers — SQLite has none.
  out = out.replace(/\s*@db\.\w+(?:\([^)]*\))?/g, "");

  // 4. Json columns are unsupported by Prisma's SQLite connector in v5.x.
  //    Store as String; src/lib/prisma.ts wraps the client with an
  //    extension that JSON-encodes on write and decodes on read when
  //    DATABASE_URL points at SQLite.
  out = out.replace(/^(\s+\w+\s+)Json(\??)/gm, (_match, prefix: string, optional: string) => {
    return `${prefix}String${optional}`;
  });

  // 5. Swap datasource provider.
  out = out.replace(
    /datasource\s+db\s*\{[^}]*\}/,
    `datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}`,
  );

  // 6. Trim generator binaryTargets — the SQLite build is desktop-only.
  out = out.replace(
    /generator\s+client\s*\{[^}]*\}/,
    `generator client {
  provider = "prisma-client-js"
}`,
  );

  // 7. Drop the now-empty enums divider and collapse 3+ blank lines.
  out = out.replace(/\/\/ -+ Enums -+\n/, "");
  out = out.replace(/\n{3,}/g, "\n\n");

  return HEADER + "\n" + out.trimStart();
}

function main(): void {
  const source = readFileSync(SOURCE, "utf8");
  const generated = generate(source);
  const check = process.argv.includes("--check");

  if (check) {
    let existing = "";
    try {
      existing = readFileSync(TARGET, "utf8");
    } catch {
      console.error(`[sync-sqlite-schema] missing ${TARGET}; run pnpm db:sync:sqlite`);
      process.exit(1);
    }
    if (existing !== generated) {
      console.error(`[sync-sqlite-schema] ${TARGET} is out of date; run pnpm db:sync:sqlite`);
      process.exit(1);
    }
    console.log(`[sync-sqlite-schema] ${TARGET} is up to date`);
    return;
  }

  mkdirSync(dirname(TARGET), { recursive: true });
  writeFileSync(TARGET, generated);
  console.log(`[sync-sqlite-schema] wrote ${TARGET}`);
}

main();
