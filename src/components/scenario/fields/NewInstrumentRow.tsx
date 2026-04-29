"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HelpTip } from "@/components/help/HelpTip";
import type { NewInstrumentDraft } from "../types";

export function NewInstrumentRow({
  value,
  onChange,
  onRemove,
}: {
  value: NewInstrumentDraft;
  onChange: (next: NewInstrumentDraft) => void;
  onRemove: () => void;
}) {
  const update = <K extends keyof NewInstrumentDraft>(
    key: K,
    v: NewInstrumentDraft[K],
  ) => onChange({ ...value, [key]: v });

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
          <Input
            value={value.label}
            onChange={(e) => update("label", e.target.value)}
          />
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
              <Label className="text-xs flex items-center gap-1.5">
                Valuation cap ($)
                <HelpTip term="valuation_cap" />
              </Label>
              <Input
                inputMode="decimal"
                value={value.valuationCap ?? ""}
                onChange={(e) => update("valuationCap", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                Discount %
                <HelpTip term="discount" />
              </Label>
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
