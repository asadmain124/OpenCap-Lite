"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { HelpTip } from "@/components/help/HelpTip";
import type { PayloadRound, ScenarioFormValues } from "../types";

export function AdvancedFields({
  form,
}: {
  form: UseFormReturn<ScenarioFormValues>;
}) {
  const round = form.watch("round");
  const update = <K extends keyof PayloadRound>(
    key: K,
    value: PayloadRound[K],
  ) => {
    form.setValue("round", { ...round, [key]: value }, { shouldDirty: true });
  };

  return (
    <>
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5">
          Conversion ordering rule
          <HelpTip term="conversion_ordering" />
        </Label>
        <Select
          value={round.conversionOrderingRule}
          onValueChange={(v) =>
            update(
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
        <Label className="flex items-center gap-1.5">
          SAFEs convert using
          <HelpTip term="best_for_investor" />
        </Label>
        <Select
          value={round.safesConvertUsing}
          onValueChange={(v) =>
            update("safesConvertUsing", v as PayloadRound["safesConvertUsing"])
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="BEST_FOR_INVESTOR">Best for investor</SelectItem>
            <SelectItem value="CAP_ONLY">Cap only</SelectItem>
            <SelectItem value="DISCOUNT_ONLY">Discount only</SelectItem>
            <SelectItem value="USER_SELECTED_PER_SAFE">
              Per-SAFE user override
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="pr" className="flex items-center gap-1.5">
          Include pro-rata rights
          <HelpTip term="pro_rata" />
        </Label>
        <Switch
          id="pr"
          checked={round.includeProRata}
          onCheckedChange={(v) => update("includeProRata", v)}
        />
      </div>
    </>
  );
}
