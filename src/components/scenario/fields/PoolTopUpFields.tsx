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

export function PoolTopUpFields({
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
          Option pool top-up mode
          <HelpTip term="pool_topup" />
        </Label>
        <Select
          value={round.optionPoolTopUpMode}
          onValueChange={(v) =>
            update(
              "optionPoolTopUpMode",
              v as PayloadRound["optionPoolTopUpMode"],
            )
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="NONE">None</SelectItem>
            <SelectItem value="TO_TARGET_POST_MONEY_PERCENT">
              Target post-money %
            </SelectItem>
            <SelectItem value="FIXED_SHARES">Fixed share count</SelectItem>
            <SelectItem value="FIXED_PERCENT_PRE_MONEY">
              Fixed % of pre-money
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      {round.optionPoolTopUpMode === "TO_TARGET_POST_MONEY_PERCENT" && (
        <div className="space-y-1.5">
          <Label htmlFor="target" className="flex items-center gap-1.5">
            Target % (fraction 0–1)
            <HelpTip term="pool_topup_target" />
          </Label>
          <Input
            id="target"
            inputMode="decimal"
            placeholder="0.10 for 10%"
            value={round.optionPoolTargetPercent ?? ""}
            onChange={(e) =>
              update("optionPoolTargetPercent", e.target.value || null)
            }
          />
        </div>
      )}
      {round.optionPoolTopUpMode === "FIXED_SHARES" && (
        <div className="space-y-1.5">
          <Label htmlFor="fixedshares" className="flex items-center gap-1.5">
            Shares to add
            <HelpTip term="pool_topup_fixed_shares" />
          </Label>
          <Input
            id="fixedshares"
            inputMode="numeric"
            value={round.optionPoolFixedShares ?? ""}
            onChange={(e) =>
              update("optionPoolFixedShares", e.target.value || null)
            }
          />
        </div>
      )}
      {round.optionPoolTopUpMode === "FIXED_PERCENT_PRE_MONEY" && (
        <div className="space-y-1.5">
          <Label htmlFor="fpp" className="flex items-center gap-1.5">
            % of pre-money FD (fraction)
            <HelpTip term="pool_topup_fixed_percent" />
          </Label>
          <Input
            id="fpp"
            inputMode="decimal"
            placeholder="0.05 for 5%"
            value={round.optionPoolFixedPercentPreMoney ?? ""}
            onChange={(e) =>
              update(
                "optionPoolFixedPercentPreMoney",
                e.target.value || null,
              )
            }
          />
        </div>
      )}
    </>
  );
}
