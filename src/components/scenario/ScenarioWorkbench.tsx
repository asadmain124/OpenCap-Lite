"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, type UseFormReturn } from "react-hook-form";
import { Wand2, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import type { SerializedBaseline } from "@/lib/baseline";
import { useSettingsStore, type BuilderMode } from "@/stores/settings";
import {
  ScenarioResults,
  type SerializedScenarioResult,
} from "@/components/results/ScenarioResults";
import { ScenarioBuilder } from "./ScenarioBuilder";
import { ScenarioWizard } from "./ScenarioWizard";
import {
  DEFAULT_ROUND,
  serializeNewInstrument,
  type InitialScenarioState,
  type ScenarioFormValues,
} from "./types";

const DRAFT_PREFIX = "opencap-lite:draft-scenario";

export interface WorkbenchChildProps {
  form: UseFormReturn<ScenarioFormValues>;
  baseline: SerializedBaseline;
  result: SerializedScenarioResult | null;
  calcLoading: boolean;
  calcError: string | null;
  saving: boolean;
  canSave: boolean;
  onSave: () => Promise<void>;
  isExisting: boolean;
}

export function ScenarioWorkbench({
  companyId,
  baseline,
  initial,
}: {
  companyId: string | null;
  baseline: SerializedBaseline | null;
  initial?: InitialScenarioState;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const builderMode = useSettingsStore((s) => s.builderMode);
  const setBuilderMode = useSettingsStore((s) => s.setBuilderMode);

  const form = useForm<ScenarioFormValues>({
    defaultValues: {
      name: initial?.name ?? "Untitled scenario",
      description: initial?.description ?? "",
      round: initial?.round ?? DEFAULT_ROUND,
      newInstruments: initial?.newInstruments ?? [],
    },
    mode: "onChange",
  });

  const draftKey = `${DRAFT_PREFIX}:${initial?.id ?? "new"}`;

  // Autosave (per-scenario key — fixes prior global slot collision)
  React.useEffect(() => {
    const timer = setInterval(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify(form.getValues()));
      } catch {
        /* ignore */
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [draftKey, form]);

  // Live calculate (300ms debounce)
  const [result, setResult] = React.useState<SerializedScenarioResult | null>(
    null,
  );
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [calcLoading, setCalcLoading] = React.useState(false);

  const round = form.watch("round");
  const newInstruments = form.watch("newInstruments");

  React.useEffect(() => {
    if (!baseline) return;
    const handle = setTimeout(async () => {
      setCalcLoading(true);
      setCalcError(null);
      try {
        const payload = {
          companyName: baseline.companyName,
          authorizedCommonShares: baseline.authorizedCommonShares,
          authorizedPreferredShares: baseline.authorizedPreferredShares,
          baseline: baseline.baseline,
          round,
          newInstruments: newInstruments.map(serializeNewInstrument),
        };
        const res = await api.post<{ data: SerializedScenarioResult }>(
          "/api/scenarios/calculate",
          payload,
        );
        setResult(res.data);
      } catch (err) {
        setCalcError(err instanceof Error ? err.message : String(err));
      } finally {
        setCalcLoading(false);
      }
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseline, JSON.stringify(round), JSON.stringify(newInstruments)]);

  const [saving, setSaving] = React.useState(false);
  const name = form.watch("name");
  const canSave = companyId != null && name.trim().length > 0;

  const onSave = async () => {
    if (!companyId || !canSave) return;
    setSaving(true);
    try {
      const v = form.getValues();
      const body = {
        scenario: {
          companyId,
          name: v.name,
          description: v.description || null,
          baselineMode: "SNAPSHOT" as const,
          snapshotJson: baseline?.baseline ?? null,
        },
        roundInput: v.round,
        newInstrumentInputs: v.newInstruments.map((i) => ({
          type: i.type,
          label: i.label,
          notesJson: {
            stakeholderName: i.stakeholderName,
            purchaseAmount: i.purchaseAmount,
            valuationCap: i.valuationCap,
            discountPercent: i.discountPercent,
            investmentAmount: i.investmentAmount,
            targetEquityPercent: i.targetEquityPercent,
            principal: i.principal,
            annualInterestRatePercent: i.annualInterestRatePercent,
            interestType: i.interestType,
            compoundingFrequencyPerYear: i.compoundingFrequencyPerYear,
          },
        })),
      };
      if (initial?.id) {
        await api.put(`/api/scenarios/${initial.id}`, body);
        toast({ title: "Scenario updated" });
        router.refresh();
      } else {
        const resp = await api.post<{ data: { id: string } }>(
          "/api/scenarios",
          body,
        );
        toast({ title: "Scenario saved" });
        router.push(`/scenarios/${resp.data.id}`);
      }
    } catch (err) {
      toast({ title: "Save failed", description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  if (!baseline) {
    return null;
  }

  const childProps: WorkbenchChildProps = {
    form,
    baseline,
    result,
    calcLoading,
    calcError,
    saving,
    canSave,
    onSave,
    isExisting: !!initial?.id,
  };

  return (
    <div className="space-y-4">
      <ModeToggle value={builderMode} onChange={setBuilderMode} />
      {builderMode === "wizard" ? (
        <ScenarioWizard {...childProps} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <ScenarioBuilder {...childProps} />
          <ScenarioResults
            result={result}
            scenarioName={name || "scenario"}
            loading={calcLoading}
            error={calcError}
          />
        </div>
      )}
    </div>
  );
}

function ModeToggle({
  value,
  onChange,
}: {
  value: BuilderMode;
  onChange: (v: BuilderMode) => void;
}) {
  return (
    <div className="inline-flex rounded-md border bg-muted/30 p-0.5 text-sm">
      <Button
        type="button"
        variant={value === "wizard" ? "default" : "ghost"}
        size="sm"
        className="h-7"
        onClick={() => onChange("wizard")}
      >
        <Wand2 className="mr-1.5 h-3.5 w-3.5" />
        Guided
      </Button>
      <Button
        type="button"
        variant={value === "expert" ? "default" : "ghost"}
        size="sm"
        className="h-7"
        onClick={() => onChange("expert")}
      >
        <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
        Expert
      </Button>
    </div>
  );
}
