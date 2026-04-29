"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HelpTip } from "@/components/help/HelpTip";
import type { PayloadRound, ScenarioFormValues } from "../types";

export function RoundBasicsFields({
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
          Round type
          <HelpTip term="round_type" />
        </Label>
        <Select
          value={round.roundType}
          onValueChange={(v) =>
            update("roundType", v as PayloadRound["roundType"])
          }
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
          <Label htmlFor="pre" className="flex items-center gap-1.5">
            Pre-money ($)
            <HelpTip term="pre_money_valuation" />
          </Label>
          <Input
            id="pre"
            inputMode="decimal"
            value={round.preMoneyValuation ?? ""}
            onChange={(e) =>
              update("preMoneyValuation", e.target.value || null)
            }
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new" className="flex items-center gap-1.5">
            New money ($)
            <HelpTip term="new_money" />
          </Label>
          <Input
            id="new"
            inputMode="decimal"
            value={round.newMoney ?? ""}
            onChange={(e) => update("newMoney", e.target.value || null)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="close">Round close date</Label>
        <Input
          id="close"
          type="date"
          value={round.roundCloseDate.slice(0, 10)}
          onChange={(e) => update("roundCloseDate", e.target.value)}
        />
      </div>
    </>
  );
}
