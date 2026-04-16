"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import { ScenarioResults, type SerializedScenarioResult } from "@/components/results/ScenarioResults";
import { useSettingsStore } from "@/stores/settings";
import type { SerializedBaseline } from "@/lib/baseline";

type PayloadRound = {
  roundType: "PRICED_ROUND" | "NEW_SAFE" | "NEW_NOTE" | "ACCELERATOR_EQUITY" | "BRIDGE";
  preMoneyValuation: string | null;
  newMoney: string | null;
  pricedRoundPricePerShareOverride: string | null;
  roundCloseDate: string;
  optionPoolTopUpMode: "NONE" | "TO_TARGET_POST_MONEY_PERCENT" | "FIXED_SHARES" | "FIXED_PERCENT_PRE_MONEY";
  optionPoolTargetPercent: string | null;
  optionPoolFixedShares: string | null;
  optionPoolFixedPercentPreMoney: string | null;
  capDenominatorMethod: "CURRENT_FULLY_DILUTED" | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES" | "USER_OVERRIDE";
  capDenominatorOverride: string | null;
  preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED" | "FULLY_DILUTED_EXCLUDING_CONVERTIBLES" | "USER_OVERRIDE";
  preMoneyDenominatorOverride: string | null;
  conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY" | "NOTES_THEN_SAFES_THEN_NEW_MONEY" | "SAFES_THEN_NOTES_THEN_NEW_MONEY" | "POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY" | "CUSTOM_SIMPLIFIED";
  notesConvertUsing: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_NOTE";
  safesConvertUsing: "BEST_FOR_INVESTOR" | "CAP_ONLY" | "DISCOUNT_ONLY" | "USER_SELECTED_PER_SAFE";
  includeProRata: boolean;
};

type NewInstrumentDraft = {
  type: "NEW_SAFE" | "NEW_NOTE" | "NEW_EQUITY" | "NEW_ACCELERATOR_EQUITY";
  label: string;
  stakeholderName: string;
  purchaseAmount?: string;
  valuationCap?: string;
  discountPercent?: string;
  investmentAmount?: string;
  targetEquityPercent?: string;
  principal?: string;
  annualInterestRatePercent?: string;
  interestType?: "SIMPLE" | "COMPOUND";
  compoundingFrequencyPerYear?: number | null;
};

export interface InitialScenarioState {
  id?: string;
  name: string;
  description: string;
  round: PayloadRound;
  newInstruments: NewInstrumentDraft[];
}

const DEFAULT_ROUND: PayloadRound = {
  roundType: "PRICED_ROUND",
  preMoneyValuation: "8000000",
  newMoney: "2000000",
  pricedRoundPricePerShareOverride: null,
  roundCloseDate: new Date().toISOString().slice(0, 10),
  optionPoolTopUpMode: "NONE",
  optionPoolTargetPercent: null,
  optionPoolFixedShares: null,
  optionPoolFixedPercentPreMoney: null,
  capDenominatorMethod: "CURRENT_FULLY_DILUTED",
  capDenominatorOverride: null,
  preMoneyDenominatorMethod: "CURRENT_FULLY_DILUTED",
  preMoneyDenominatorOverride: null,
  conversionOrderingRule: "CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY",
  notesConvertUsing: "BEST_FOR_INVESTOR",
  safesConvertUsing: "BEST_FOR_INVESTOR",
  includeProRata: false,
};

function serializeNewInstrument(i: NewInstrumentDraft) {
  return {
    type: i.type,
    label: i.label,
    stakeholderName: i.stakeholderName,
    purchaseAmount: i.purchaseAmount,
    valuationCap: i.valuationCap || null,
    discountPercent: i.discountPercent || null,
    investmentAmount: i.investmentAmount,
    targetEquityPercent: i.targetEquityPercent,
    principal: i.principal,
    annualInterestRatePercent: i.annualInterestRatePercent,
    interestType: i.interestType,
    compoundingFrequencyPerYear: i.compoundingFrequencyPerYear ?? null,
  };
}

export function ScenarioBuilder({
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
  const advancedMode = useSettingsStore((s) => s.advancedMode);

  const [name, setName] = React.useState(initial?.name ?? "Untitled scenario");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [round, setRound] = React.useState<PayloadRound>(initial?.round ?? { ...DEFAULT_ROUND });
  const [newInstruments, setNewInstruments] = React.useState<NewInstrumentDraft[]>(
    initial?.newInstruments ?? [],
  );

  const [result, setResult] = React.useState<SerializedScenarioResult | null>(null);
  const [calcError, setCalcError] = React.useState<string | null>(null);
  const [calcLoading, setCalcLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  // Autosave draft
  React.useEffect(() => {
    const draft = { name, description, round, newInstruments };
    const timer = setInterval(() => {
      try {
        localStorage.setItem("opencap-lite:draft-scenario", JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [name, description, round, newInstruments]);

  // Live calculation (debounced)
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
  }, [baseline, round, newInstruments]);

  const canSave = companyId != null && name.trim().length > 0;

  const onSave = async () => {
    if (!companyId || !canSave) return;
    setSaving(true);
    try {
      const body = {
        scenario: {
          companyId,
          name,
          description: description || null,
          baselineMode: "SNAPSHOT" as const,
          snapshotJson: baseline?.baseline ?? null,
        },
        roundInput: round,
        newInstrumentInputs: newInstruments.map((i) => ({
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
      } else {
        const resp = await api.post<{ data: { id: string } }>("/api/scenarios", body);
        toast({ title: "Scenario saved" });
        router.push(`/scenarios/${resp.data.id}`);
        return;
      }
      router.refresh();
    } catch (err) {
      toast({ title: "Save failed", description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  const updateRound = <K extends keyof PayloadRound>(key: K, value: PayloadRound[K]) => {
    setRound((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Scenario Assumptions</CardTitle>
          <CardDescription>Live preview updates 300ms after you stop typing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Accordion type="multiple" defaultValue={["basics", "round", "new-instruments"]}>
            <AccordionItem value="basics">
              <AccordionTrigger>Basics</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sc-name">Name</Label>
                  <Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sc-desc">Description</Label>
                  <Input
                    id="sc-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="round">
              <AccordionTrigger>Round</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Round Type</Label>
                  <Select
                    value={round.roundType}
                    onValueChange={(v) => updateRound("roundType", v as PayloadRound["roundType"])}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRICED_ROUND">Priced round</SelectItem>
                      <SelectItem value="NEW_SAFE">New SAFE bridge</SelectItem>
                      <SelectItem value="NEW_NOTE">New note</SelectItem>
                      <SelectItem value="ACCELERATOR_EQUITY">Accelerator equity</SelectItem>
                      <SelectItem value="BRIDGE">Bridge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="pre">Pre-money ($)</Label>
                    <Input
                      id="pre"
                      inputMode="decimal"
                      value={round.preMoneyValuation ?? ""}
                      onChange={(e) => updateRound("preMoneyValuation", e.target.value || null)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new">New money ($)</Label>
                    <Input
                      id="new"
                      inputMode="decimal"
                      value={round.newMoney ?? ""}
                      onChange={(e) => updateRound("newMoney", e.target.value || null)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="close">Round close date</Label>
                  <Input
                    id="close"
                    type="date"
                    value={round.roundCloseDate.slice(0, 10)}
                    onChange={(e) => updateRound("roundCloseDate", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Option pool top-up mode</Label>
                  <Select
                    value={round.optionPoolTopUpMode}
                    onValueChange={(v) =>
                      updateRound("optionPoolTopUpMode", v as PayloadRound["optionPoolTopUpMode"])
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NONE">None</SelectItem>
                      <SelectItem value="TO_TARGET_POST_MONEY_PERCENT">Target post-money %</SelectItem>
                      <SelectItem value="FIXED_SHARES">Fixed share count</SelectItem>
                      <SelectItem value="FIXED_PERCENT_PRE_MONEY">Fixed % of pre-money</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {round.optionPoolTopUpMode === "TO_TARGET_POST_MONEY_PERCENT" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="target">Target % (fraction 0-1)</Label>
                    <Input
                      id="target"
                      inputMode="decimal"
                      placeholder="0.10 for 10%"
                      value={round.optionPoolTargetPercent ?? ""}
                      onChange={(e) =>
                        updateRound("optionPoolTargetPercent", e.target.value || null)
                      }
                    />
                  </div>
                )}
                {round.optionPoolTopUpMode === "FIXED_SHARES" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fixedshares">Shares to add</Label>
                    <Input
                      id="fixedshares"
                      inputMode="numeric"
                      value={round.optionPoolFixedShares ?? ""}
                      onChange={(e) =>
                        updateRound("optionPoolFixedShares", e.target.value || null)
                      }
                    />
                  </div>
                )}
                {round.optionPoolTopUpMode === "FIXED_PERCENT_PRE_MONEY" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fpp">% of pre-money FD (fraction)</Label>
                    <Input
                      id="fpp"
                      inputMode="decimal"
                      placeholder="0.05 for 5%"
                      value={round.optionPoolFixedPercentPreMoney ?? ""}
                      onChange={(e) =>
                        updateRound("optionPoolFixedPercentPreMoney", e.target.value || null)
                      }
                    />
                  </div>
                )}
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="new-instruments">
              <AccordionTrigger>New instruments ({newInstruments.length})</AccordionTrigger>
              <AccordionContent className="space-y-3">
                {newInstruments.map((inst, idx) => (
                  <NewInstrumentRow
                    key={idx}
                    value={inst}
                    onChange={(next) =>
                      setNewInstruments((prev) => prev.map((p, i) => (i === idx ? next : p)))
                    }
                    onRemove={() =>
                      setNewInstruments((prev) => prev.filter((_, i) => i !== idx))
                    }
                  />
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewInstruments((prev) => [
                        ...prev,
                        {
                          type: "NEW_EQUITY",
                          label: "Lead investor",
                          stakeholderName: "New Investor",
                          investmentAmount: "2000000",
                        },
                      ])
                    }
                  >
                    + New equity
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewInstruments((prev) => [
                        ...prev,
                        {
                          type: "NEW_SAFE",
                          label: "New SAFE",
                          stakeholderName: "New VC",
                          purchaseAmount: "500000",
                          valuationCap: "10000000",
                        },
                      ])
                    }
                  >
                    + New SAFE
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setNewInstruments((prev) => [
                        ...prev,
                        {
                          type: "NEW_ACCELERATOR_EQUITY",
                          label: "Accelerator 7%",
                          stakeholderName: "Accelerator",
                          targetEquityPercent: "0.07",
                        },
                      ])
                    }
                  >
                    + Accelerator
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>

            {advancedMode && (
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced</AccordionTrigger>
                <AccordionContent className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Conversion ordering rule</Label>
                    <Select
                      value={round.conversionOrderingRule}
                      onValueChange={(v) =>
                        updateRound(
                          "conversionOrderingRule",
                          v as PayloadRound["conversionOrderingRule"],
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CONVERTIBLES_THEN_POOL_TOPUP_THEN_NEW_MONEY">
                          Convertibles → Pool → New Money (default)
                        </SelectItem>
                        <SelectItem value="NOTES_THEN_SAFES_THEN_NEW_MONEY">
                          Notes → SAFEs → New Money
                        </SelectItem>
                        <SelectItem value="SAFES_THEN_NOTES_THEN_NEW_MONEY">
                          SAFEs → Notes → New Money
                        </SelectItem>
                        <SelectItem value="POOL_TOPUP_THEN_CONVERTIBLES_THEN_NEW_MONEY">
                          Pool → Convertibles → New Money
                        </SelectItem>
                        <SelectItem value="CUSTOM_SIMPLIFIED">Custom simplified</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>SAFEs convert using</Label>
                    <Select
                      value={round.safesConvertUsing}
                      onValueChange={(v) =>
                        updateRound("safesConvertUsing", v as PayloadRound["safesConvertUsing"])
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BEST_FOR_INVESTOR">Best for investor</SelectItem>
                        <SelectItem value="CAP_ONLY">Cap only</SelectItem>
                        <SelectItem value="DISCOUNT_ONLY">Discount only</SelectItem>
                        <SelectItem value="USER_SELECTED_PER_SAFE">Per-SAFE user override</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="pr">Include pro-rata rights</Label>
                    <Switch
                      id="pr"
                      checked={round.includeProRata}
                      onCheckedChange={(v) => updateRound("includeProRata", v)}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>

          <div className="flex gap-2">
            <Button onClick={onSave} disabled={!canSave || saving}>
              {saving ? "Saving…" : initial?.id ? "Save changes" : "Save scenario"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div>
        <ScenarioResults
          result={result}
          scenarioName={name || "scenario"}
          loading={calcLoading}
          error={calcError}
        />
      </div>
    </div>
  );
}

function NewInstrumentRow({
  value,
  onChange,
  onRemove,
}: {
  value: NewInstrumentDraft;
  onChange: (next: NewInstrumentDraft) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof NewInstrumentDraft>(key: K, v: NewInstrumentDraft[K]) =>
    onChange({ ...value, [key]: v });
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium">{value.type}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Label</Label>
          <Input value={value.label} onChange={(e) => update("label", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Stakeholder</Label>
          <Input
            value={value.stakeholderName}
            onChange={(e) => update("stakeholderName", e.target.value)}
          />
        </div>
        {value.type === "NEW_EQUITY" && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Investment amount ($)</Label>
            <Input
              inputMode="decimal"
              value={value.investmentAmount ?? ""}
              onChange={(e) => update("investmentAmount", e.target.value)}
            />
          </div>
        )}
        {value.type === "NEW_SAFE" && (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Purchase ($)</Label>
              <Input
                inputMode="decimal"
                value={value.purchaseAmount ?? ""}
                onChange={(e) => update("purchaseAmount", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Valuation Cap ($)</Label>
              <Input
                inputMode="decimal"
                value={value.valuationCap ?? ""}
                onChange={(e) => update("valuationCap", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Discount %</Label>
              <Input
                inputMode="decimal"
                value={value.discountPercent ?? ""}
                onChange={(e) => update("discountPercent", e.target.value)}
              />
            </div>
          </>
        )}
        {value.type === "NEW_ACCELERATOR_EQUITY" && (
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Target % (0.07 for 7%)</Label>
            <Input
              inputMode="decimal"
              value={value.targetEquityPercent ?? ""}
              onChange={(e) => update("targetEquityPercent", e.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
