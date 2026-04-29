"use client";

import * as React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";

export function NewCompanyDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (id: string) => void | Promise<void>;
}) {
  const { toast } = useToast();
  const [legalName, setLegalName] = React.useState("");
  const [jurisdiction, setJurisdiction] = React.useState("Delaware");
  const [authorizedCommonShares, setAuthorizedCommonShares] =
    React.useState("10000000");
  const [authorizedPreferredShares, setAuthorizedPreferredShares] =
    React.useState("0");
  const [defaultCurrency, setDefaultCurrency] = React.useState("USD");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setLegalName("");
      setJurisdiction("Delaware");
      setAuthorizedCommonShares("10000000");
      setAuthorizedPreferredShares("0");
      setDefaultCurrency("USD");
    }
  }, [open]);

  const submit = async () => {
    if (!legalName.trim() || !jurisdiction.trim()) {
      toast({ title: "Legal name and jurisdiction are required" });
      return;
    }
    setSubmitting(true);
    try {
      const resp = await api.post<{ data: { id: string } }>("/api/companies", {
        legalName: legalName.trim(),
        jurisdiction: jurisdiction.trim(),
        authorizedCommonShares: authorizedCommonShares || "0",
        authorizedPreferredShares: authorizedPreferredShares || "0",
        defaultCurrency: defaultCurrency.toUpperCase(),
      });
      await onCreated(resp.data.id);
    } catch (err) {
      toast({
        title: "Could not create company",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New company</DialogTitle>
          <DialogDescription>
            Each company has its own cap table, stakeholders, and scenarios.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Legal name</Label>
            <Input
              id="nc-name"
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Acme Labs, Inc."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-jur">Jurisdiction</Label>
              <Input
                id="nc-jur"
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-cur">Currency</Label>
              <Input
                id="nc-cur"
                value={defaultCurrency}
                onChange={(e) =>
                  setDefaultCurrency(e.target.value.toUpperCase().slice(0, 3))
                }
                maxLength={3}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nc-common">Authorized common</Label>
              <Input
                id="nc-common"
                inputMode="numeric"
                value={authorizedCommonShares}
                onChange={(e) => setAuthorizedCommonShares(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-pref">Authorized preferred</Label>
              <Input
                id="nc-pref"
                inputMode="numeric"
                value={authorizedPreferredShares}
                onChange={(e) => setAuthorizedPreferredShares(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Creating…" : "Create company"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
