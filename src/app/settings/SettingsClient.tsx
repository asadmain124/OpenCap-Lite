"use client";

import * as React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useSettingsStore } from "@/stores/settings";

export function SettingsClient({ companyId: _companyId }: { companyId: string | null }) {
  const advancedMode = useSettingsStore((s) => s.advancedMode);
  const setAdvancedMode = useSettingsStore((s) => s.setAdvancedMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Global Preferences</CardTitle>
        <CardDescription>Stored locally in your browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="adv-mode">Advanced mode</Label>
            <p className="text-xs text-muted-foreground">
              Shows conversion ordering rule, MFN fallback, and per-instrument overrides.
            </p>
          </div>
          <Switch id="adv-mode" checked={advancedMode} onCheckedChange={setAdvancedMode} />
        </div>
      </CardContent>
    </Card>
  );
}
