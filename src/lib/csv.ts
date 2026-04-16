import Papa from "papaparse";

export interface CsvColumn<T> {
  key: keyof T;
  header: string;
  format?: (value: unknown, row: T) => string;
}

export function buildCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: CsvColumn<T>[],
): string {
  const header = columns.map((c) => c.header);
  const data = rows.map((row) =>
    columns.map((col) => {
      const raw = row[col.key];
      if (col.format) return col.format(raw, row);
      if (raw == null) return "";
      if (typeof raw === "bigint") return raw.toString();
      if (raw instanceof Date) return raw.toISOString();
      if (typeof raw === "object") return JSON.stringify(raw);
      return String(raw);
    }),
  );
  return Papa.unparse({ fields: header, data });
}

export interface CsvParseResult<T> {
  rows: T[];
  failures: { row: number; error: string }[];
}

export function parseCsv<T>(
  raw: string,
  validate: (row: Record<string, string>) => T,
): CsvParseResult<T> {
  const parsed = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
  });
  const rows: T[] = [];
  const failures: { row: number; error: string }[] = [];
  parsed.data.forEach((rec, i) => {
    try {
      rows.push(validate(rec));
    } catch (e) {
      failures.push({ row: i + 2, error: e instanceof Error ? e.message : String(e) });
    }
  });
  return { rows, failures };
}
