"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DEFAULT_ROUND,
  newId,
  type ScenarioFormValues,
} from "./types";

interface Template {
  key: string;
  label: string;
  hint: string;
  values: ScenarioFormValues;
}

function makeTemplates(): Template[] {
  const today = new Date().toISOString().slice(0, 10);
  return [
    {
      key: "safe-1m",
      label: "$1M SAFE bridge",
      hint: "Single SAFE, $10M cap, no priced round.",
      values: {
        name: "$1M SAFE bridge",
        description: "Single SAFE on $10M post-money cap.",
        round: {
          ...DEFAULT_ROUND,
          roundType: "NEW_SAFE",
          preMoneyValuation: null,
          newMoney: null,
          roundCloseDate: today,
        },
        newInstruments: [
          {
            id: newId(),
            type: "NEW_SAFE",
            label: "Lead SAFE",
            stakeholderName: "Lead Investor",
            purchaseAmount: "1000000",
            valuationCap: "10000000",
          },
        ],
      },
    },
    {
      key: "seed-2m",
      label: "$2M priced seed (10% pool)",
      hint: "$8M pre, $2M new, target 10% post-money pool.",
      values: {
        name: "$2M priced seed",
        description: "Priced seed with 10% post-money option pool top-up.",
        round: {
          ...DEFAULT_ROUND,
          roundType: "PRICED_ROUND",
          preMoneyValuation: "8000000",
          newMoney: "2000000",
          roundCloseDate: today,
          optionPoolTopUpMode: "TO_TARGET_POST_MONEY_PERCENT",
          optionPoolTargetPercent: "0.10",
        },
        newInstruments: [
          {
            id: newId(),
            type: "NEW_EQUITY",
            label: "Lead investor",
            stakeholderName: "Seed VC",
            investmentAmount: "2000000",
          },
        ],
      },
    },
    {
      key: "series-a-5m",
      label: "$5M Series A converting SAFEs",
      hint: "$20M pre, $5M new, 10% pool. Existing SAFEs convert.",
      values: {
        name: "$5M Series A",
        description: "Priced Series A; existing SAFEs convert at this round.",
        round: {
          ...DEFAULT_ROUND,
          roundType: "PRICED_ROUND",
          preMoneyValuation: "20000000",
          newMoney: "5000000",
          roundCloseDate: today,
          optionPoolTopUpMode: "TO_TARGET_POST_MONEY_PERCENT",
          optionPoolTargetPercent: "0.10",
        },
        newInstruments: [
          {
            id: newId(),
            type: "NEW_EQUITY",
            label: "Lead investor",
            stakeholderName: "Series A Lead",
            investmentAmount: "5000000",
          },
        ],
      },
    },
    {
      key: "accelerator",
      label: "Accelerator 7%",
      hint: "Fixed-equity accelerator grant (e.g. YC).",
      values: {
        name: "Accelerator (7%)",
        description: "Standard YC-style 7% post-investment equity.",
        round: {
          ...DEFAULT_ROUND,
          roundType: "ACCELERATOR_EQUITY",
          preMoneyValuation: null,
          newMoney: null,
          roundCloseDate: today,
        },
        newInstruments: [
          {
            id: newId(),
            type: "NEW_ACCELERATOR_EQUITY",
            label: "Accelerator 7%",
            stakeholderName: "Accelerator",
            targetEquityPercent: "0.07",
          },
        ],
      },
    },
  ];
}

export function ScenarioTemplates({
  form,
}: {
  form: UseFormReturn<ScenarioFormValues>;
}) {
  const templates = React.useMemo(() => makeTemplates(), []);
  const [pending, setPending] = React.useState<Template | null>(null);

  const apply = (t: Template) => {
    if (form.formState.isDirty) {
      setPending(t);
    } else {
      form.reset(t.values);
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-dashed bg-muted/20 p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        Start from a template
      </div>
      <div className="flex flex-wrap gap-2">
        {templates.map((t) => (
          <Button
            key={t.key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => apply(t)}
            title={t.hint}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <AlertDialog
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your current draft?</AlertDialogTitle>
            <AlertDialogDescription>
              Applying the &ldquo;{pending?.label}&rdquo; template will overwrite the
              values you&rsquo;ve entered so far.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) form.reset(pending.values);
                setPending(null);
              }}
            >
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
