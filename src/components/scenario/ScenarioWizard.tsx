"use client";

import * as React from "react";
import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { ScenarioResults } from "@/components/results/ScenarioResults";
import { cn } from "@/lib/utils";
import { BasicsFields } from "./fields/BasicsFields";
import { RoundBasicsFields } from "./fields/RoundBasicsFields";
import { AdvancedFields } from "./fields/AdvancedFields";
import { NewInstrumentList } from "./fields/NewInstrumentList";
import { PoolTopUpFields } from "./fields/PoolTopUpFields";
import { ScenarioTemplates } from "./ScenarioTemplates";
import type { WorkbenchChildProps } from "./ScenarioWorkbench";

type StepId = "basics" | "round" | "convertibles" | "investors" | "pool" | "review";

interface Step {
  id: StepId;
  label: string;
  description: string;
  isValid: (form: WorkbenchChildProps["form"]) => boolean;
}

const STEPS: Step[] = [
  {
    id: "basics",
    label: "Name",
    description: "Give this scenario a name.",
    isValid: (f) => f.getValues("name").trim().length > 0,
  },
  {
    id: "round",
    label: "Round",
    description: "What kind of round are you modeling?",
    isValid: (f) => {
      const r = f.getValues("round");
      if (r.roundType === "PRICED_ROUND" || r.roundType === "BRIDGE") {
        return !!r.preMoneyValuation && !!r.newMoney && !!r.roundCloseDate;
      }
      return !!r.roundCloseDate;
    },
  },
  {
    id: "convertibles",
    label: "Conversions",
    description: "How should existing SAFEs and notes convert?",
    isValid: () => true,
  },
  {
    id: "investors",
    label: "Investors",
    description: "Add the new SAFEs, notes, or equity for this round.",
    isValid: () => true,
  },
  {
    id: "pool",
    label: "Pool",
    description: "Refresh the option pool as part of the round (optional).",
    isValid: () => true,
  },
  {
    id: "review",
    label: "Review",
    description: "Plain-English summary and live preview before you save.",
    isValid: () => true,
  },
];

export function ScenarioWizard({
  form,
  result,
  calcLoading,
  calcError,
  saving,
  canSave,
  onSave,
  isExisting,
}: WorkbenchChildProps) {
  const { toast } = useToast();
  const [stepIndex, setStepIndex] = React.useState(0);
  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;
  const name = form.watch("name");

  const goNext = () => {
    if (!step.isValid(form)) {
      toast({
        title: "Fill in the required fields before continuing",
      });
      return;
    }
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => setStepIndex((i) => Math.max(i - 1, 0));

  return (
    <div className="space-y-4">
      <Stepper
        steps={STEPS}
        current={stepIndex}
        onJump={(i) => {
          // Allow jumping back freely; forward only if all earlier steps valid
          if (i <= stepIndex) {
            setStepIndex(i);
            return;
          }
          for (let j = stepIndex; j < i; j++) {
            if (!STEPS[j].isValid(form)) {
              toast({ title: `Complete "${STEPS[j].label}" first` });
              return;
            }
          }
          setStepIndex(i);
        }}
      />

      <Card>
        <CardHeader>
          <CardTitle>{step.label}</CardTitle>
          <CardDescription>{step.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step.id === "basics" && (
            <>
              {!isExisting && <ScenarioTemplates form={form} />}
              <BasicsFields form={form} />
            </>
          )}
          {step.id === "round" && <RoundBasicsFields form={form} />}
          {step.id === "convertibles" && <AdvancedFields form={form} />}
          {step.id === "investors" && <NewInstrumentList form={form} />}
          {step.id === "pool" && <PoolTopUpFields form={form} />}
          {step.id === "review" && (
            <ScenarioResults
              result={result}
              scenarioName={name || "scenario"}
              loading={calcLoading}
              error={calcError}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={stepIndex === 0}
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        {isLast ? (
          <Button onClick={onSave} disabled={!canSave || saving}>
            <Save className="mr-1 h-4 w-4" />
            {saving ? "Saving…" : isExisting ? "Save changes" : "Save scenario"}
          </Button>
        ) : (
          <Button onClick={goNext}>
            Next <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Stepper({
  steps,
  current,
  onJump,
}: {
  steps: Step[];
  current: number;
  onJump: (i: number) => void;
}) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        const isDone = i < current;
        return (
          <li key={s.id} className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onJump(i)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition-colors",
                isCurrent && "border-primary bg-primary text-primary-foreground",
                isDone && !isCurrent && "border-primary/40 text-primary",
                !isCurrent && !isDone && "text-muted-foreground hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                  isCurrent ? "bg-primary-foreground/20" : "bg-muted",
                  isDone && "bg-primary text-primary-foreground",
                )}
              >
                {isDone ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </button>
            {i < steps.length - 1 && (
              <span className="text-muted-foreground">→</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
