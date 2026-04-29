"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSettingsStore } from "@/stores/settings";
import { BasicsFields } from "./fields/BasicsFields";
import { RoundBasicsFields } from "./fields/RoundBasicsFields";
import { PoolTopUpFields } from "./fields/PoolTopUpFields";
import { NewInstrumentList } from "./fields/NewInstrumentList";
import { AdvancedFields } from "./fields/AdvancedFields";
import type { WorkbenchChildProps } from "./ScenarioWorkbench";

/**
 * Expert mode: every field group exposed at once inside accordions.
 * State, calculate, autosave, and onSave live in <ScenarioWorkbench>.
 */
export function ScenarioBuilder({
  form,
  saving,
  canSave,
  onSave,
  isExisting,
}: WorkbenchChildProps) {
  const advancedMode = useSettingsStore((s) => s.advancedMode);

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>Scenario assumptions</CardTitle>
        <CardDescription>
          Live preview updates 300ms after you stop typing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion
          type="multiple"
          defaultValue={["basics", "round", "new-instruments"]}
        >
          <AccordionItem value="basics">
            <AccordionTrigger>Basics</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <BasicsFields form={form} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="round">
            <AccordionTrigger>Round</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <RoundBasicsFields form={form} />
              <PoolTopUpFields form={form} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="new-instruments">
            <AccordionTrigger>New instruments</AccordionTrigger>
            <AccordionContent className="space-y-3">
              <NewInstrumentList form={form} />
            </AccordionContent>
          </AccordionItem>

          {advancedMode && (
            <AccordionItem value="advanced">
              <AccordionTrigger>Advanced</AccordionTrigger>
              <AccordionContent className="space-y-3">
                <AdvancedFields form={form} />
              </AccordionContent>
            </AccordionItem>
          )}
        </Accordion>

        <div className="flex gap-2">
          <Button onClick={onSave} disabled={!canSave || saving}>
            {saving ? "Saving…" : isExisting ? "Save changes" : "Save scenario"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
