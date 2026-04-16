import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { serializeBigInts } from "@/lib/utils";

export interface ApiError {
  error: string;
  code: string;
  details?: unknown;
}

export function toApiError(error: unknown, fallbackStatus = 500): NextResponse<ApiError> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", code: "VALIDATION_ERROR", details: error.issues },
      { status: 400 },
    );
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return NextResponse.json(
        { error: "Record not found", code: "NOT_FOUND" },
        { status: 404 },
      );
    }
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Unique constraint violation", code: "UNIQUE_VIOLATION", details: error.meta },
        { status: 409 },
      );
    }
    if (error.code === "P2003") {
      return NextResponse.json(
        { error: "Foreign key constraint failed", code: "FK_VIOLATION", details: error.meta },
        { status: 409 },
      );
    }
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  // eslint-disable-next-line no-console
  console.error("API error:", error);
  return NextResponse.json(
    { error: message, code: "INTERNAL_ERROR" },
    { status: fallbackStatus },
  );
}

function decimalToString(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v !== "object") return v;
  if (v instanceof Date) return v.toISOString();
  const ctorName = (v as { constructor?: { name?: string } }).constructor?.name;
  if (ctorName === "Decimal" || ctorName === "Prisma.Decimal") {
    return (v as { toString(): string }).toString();
  }
  if (Array.isArray(v)) return v.map(decimalToString);
  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = decimalToString(val);
  return out;
}

export function ok<T>(data: T, extra: Record<string, unknown> = {}, init?: ResponseInit): NextResponse {
  const body = { data: serializeBigInts(decimalToString(data) as T), ...extra };
  return NextResponse.json(body, init);
}

export function created<T>(data: T, extra: Record<string, unknown> = {}): NextResponse {
  return ok(data, extra, { status: 201 });
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
