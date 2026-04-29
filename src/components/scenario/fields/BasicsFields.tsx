"use client";

import * as React from "react";
import { type UseFormReturn } from "react-hook-form";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ScenarioFormValues } from "../types";

export function BasicsFields({
  form,
}: {
  form: UseFormReturn<ScenarioFormValues>;
}) {
  const name = form.watch("name");
  const description = form.watch("description");
  return (
    <>
      <div className="space-y-1.5">
        <Label htmlFor="sc-name">Name</Label>
        <Input
          id="sc-name"
          value={name}
          onChange={(e) =>
            form.setValue("name", e.target.value, { shouldDirty: true })
          }
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sc-desc">Description</Label>
        <Input
          id="sc-desc"
          value={description}
          onChange={(e) =>
            form.setValue("description", e.target.value, { shouldDirty: true })
          }
        />
      </div>
    </>
  );
}
