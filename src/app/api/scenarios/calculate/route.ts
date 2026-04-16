import { NextRequest } from "next/server";
import { scenarioCalculatePayloadSchema } from "@/lib/validators";
import { runScenario } from "@/lib/scenario-engine/orchestrator";
import type { ScenarioInput } from "@/lib/scenario-engine/types";
import { ok, toApiError } from "@/lib/api/response";

/**
 * POST /api/scenarios/calculate — non-mutating scenario calculation.
 *
 * Accepts a full ScenarioInput payload. Does NOT write to the database.
 * The payload baseline must be supplied by the caller.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = scenarioCalculatePayloadSchema.parse(body);

    const input = parsed as unknown as ScenarioInput;
    const result = runScenario(input);
    return ok(result);
  } catch (e) {
    return toApiError(e);
  }
}
