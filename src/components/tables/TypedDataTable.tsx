"use client";

import * as React from "react";
import { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "./DataTable";

/**
 * Thin wrapper around DataTable that types the columns generically without
 * requiring call sites to fight column-type inference. Pass a memoized
 * `columns` array and any `data`.
 */
export function TypedDataTable<T>({
  columns,
  data,
  filterPlaceholder,
  emptyMessage,
}: {
  columns: ColumnDef<T, unknown>[];
  data: T[];
  filterPlaceholder?: string;
  emptyMessage?: string;
}) {
  return (
    <DataTable<T, unknown>
      columns={columns}
      data={data}
      filterPlaceholder={filterPlaceholder}
      emptyMessage={emptyMessage}
    />
  );
}
