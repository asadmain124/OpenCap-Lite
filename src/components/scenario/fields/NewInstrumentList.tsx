"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { newId, type NewInstrumentDraft, type ScenarioFormValues } from "../types";
import { NewInstrumentRow } from "./NewInstrumentRow";

export function NewInstrumentList({
  form,
}: {
  form: UseFormReturn<ScenarioFormValues>;
}) {
  const instruments = form.watch("newInstruments");

  const setInstruments = (next: NewInstrumentDraft[]) => {
    form.setValue("newInstruments", next, { shouldDirty: true });
  };

  const add = (draft: Omit<NewInstrumentDraft, "id">) => {
    setInstruments([...instruments, { ...draft, id: newId() }]);
  };

  return (
    <div className="space-y-3">
      {instruments.map((inst, idx) => (
        <NewInstrumentRow
          key={inst.id}
          value={inst}
          onChange={(next) =>
            setInstruments(instruments.map((p, i) => (i === idx ? next : p)))
          }
          onRemove={() =>
            setInstruments(instruments.filter((_, i) => i !== idx))
          }
        />
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            add({
              type: "NEW_EQUITY",
              label: "Lead investor",
              stakeholderName: "New Investor",
              investmentAmount: "2000000",
            })
          }
        >
          + New equity
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            add({
              type: "NEW_SAFE",
              label: "New SAFE",
              stakeholderName: "New VC",
              purchaseAmount: "500000",
              valuationCap: "10000000",
            })
          }
        >
          + New SAFE
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            add({
              type: "NEW_ACCELERATOR_EQUITY",
              label: "Accelerator 7%",
              stakeholderName: "Accelerator",
              targetEquityPercent: "0.07",
            })
          }
        >
          + Accelerator
        </Button>
      </div>
    </div>
  );
}
