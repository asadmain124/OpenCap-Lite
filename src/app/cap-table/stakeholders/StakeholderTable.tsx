"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { DataTable, type RowAction } from "@/components/tables/DataTable";
import { api } from "@/lib/api/client";
import { useToast } from "@/components/ui/use-toast";

interface Row {
  id: string;
  name: string;
  type: string;
  email: string | null;
  notes: string | null;
}

interface SecurityClassOption {
  id: string;
  name: string;
  type: string;
}

const STAKEHOLDER_TYPES = [
  "FOUNDER",
  "EMPLOYEE",
  "ADVISOR",
  "ANGEL",
  "VC",
  "ACCELERATOR",
  "OTHER",
] as const;

export function StakeholderTable({
  companyId,
  rows,
  securityClasses,
}: {
  companyId: string | null;
  rows: Row[];
  securityClasses: SecurityClassOption[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      { accessorKey: "type", header: "Type" },
      { accessorKey: "email", header: "Email", cell: ({ row }) => row.original.email ?? "—" },
      {
        accessorKey: "notes",
        header: "Notes",
        cell: ({ row }) => (
          <span className="line-clamp-1 max-w-sm text-muted-foreground">
            {row.original.notes ?? "—"}
          </span>
        ),
      },
    ],
    [],
  );

  const actions = (row: Row): RowAction<Row>[] => [
    { label: "Edit", onSelect: () => { setEditing(row); setDialogOpen(true); } },
    {
      label: "Duplicate",
      onSelect: async () => {
        if (!companyId) return;
        try {
          await api.post("/api/stakeholders", {
            companyId,
            name: `${row.name} (copy)`,
            type: row.type,
            email: row.email,
            notes: row.notes,
          });
          router.refresh();
        } catch (e) {
          toast({ title: "Duplicate failed", description: String(e) });
        }
      },
    },
    { label: "Delete", destructive: true, onSelect: () => setConfirmDelete(row) },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter by name</p>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button>+ Add stakeholder</Button>
          </DialogTrigger>
          <StakeholderForm
            key={editing?.id ?? "new"}
            companyId={companyId}
            initial={editing}
            securityClasses={securityClasses}
            onClose={(refresh) => {
              setDialogOpen(false);
              setEditing(null);
              if (refresh) router.refresh();
            }}
          />
        </Dialog>
      </div>

      <DataTable<Row, unknown>
        columns={columns}
        data={rows}
        filterPlaceholder="Filter by name..."
        renderRowActions={actions}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the stakeholder{" "}
              <strong>and everything they hold</strong> — equity holdings,
              option grants, SAFEs, notes. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.delete(`/api/stakeholders/${confirmDelete.id}`);
                  setConfirmDelete(null);
                  router.refresh();
                } catch (e) {
                  toast({ title: "Delete failed", description: String(e) });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StakeholderForm({
  companyId,
  initial,
  securityClasses,
  onClose,
}: {
  companyId: string | null;
  initial: Row | null;
  securityClasses: SecurityClassOption[];
  onClose: (refresh: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState(initial?.type ?? "EMPLOYEE");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [busy, setBusy] = React.useState(false);

  // Optional holding section
  const [addHolding, setAddHolding] = React.useState(false);
  const defaultClass =
    securityClasses.find((c) => c.type === "COMMON")?.id ??
    securityClasses[0]?.id ??
    "";
  const [holdingClassId, setHoldingClassId] = React.useState(defaultClass);
  const [shareCount, setShareCount] = React.useState("");
  const [pricePaid, setPricePaid] = React.useState("");
  const [issueDate, setIssueDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );

  // Optional option-grant section
  const [addGrant, setAddGrant] = React.useState(false);
  const [optionCount, setOptionCount] = React.useState("");
  const [strikePrice, setStrikePrice] = React.useState("");
  const [grantDate, setGrantDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );
  const [vestingDuration, setVestingDuration] = React.useState("48");
  const [vestingCliff, setVestingCliff] = React.useState("12");

  const isEdit = !!initial;
  const canAddHolding = !isEdit && securityClasses.length > 0;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    try {
      let stakeholderId: string;
      if (isEdit) {
        await api.put(`/api/stakeholders/${initial!.id}`, {
          name,
          type,
          email: email || null,
          notes: notes || null,
        });
        stakeholderId = initial!.id;
      } else {
        const resp = await api.post<{ data: { id: string } }>(
          "/api/stakeholders",
          {
            companyId,
            name,
            type,
            email: email || null,
            notes: notes || null,
          },
        );
        stakeholderId = resp.data.id;
      }

      // Create-only side effects
      if (!isEdit && addHolding && holdingClassId && shareCount) {
        try {
          await api.post("/api/holdings", {
            companyId,
            stakeholderId,
            securityClassId: holdingClassId,
            shareCount,
            pricePaidPerShare: pricePaid || null,
            issueDate,
            status: "ACTIVE",
          });
        } catch (err) {
          toast({
            title: "Stakeholder created, but holding failed",
            description: String(err),
          });
        }
      }
      if (!isEdit && addGrant && optionCount && strikePrice) {
        try {
          await api.post("/api/option-grants", {
            companyId,
            stakeholderId,
            optionCount,
            strikePrice,
            grantDate,
            vesting: {
              vestingStartDate: grantDate,
              vestingCliffMonths: Number(vestingCliff) || 0,
              vestingDurationMonths: Number(vestingDuration) || 0,
              vestingFrequency: "MONTHLY",
            },
          });
        } catch (err) {
          toast({
            title: "Stakeholder created, but option grant failed",
            description: String(err),
          });
        }
      }
      onClose(true);
    } catch (err) {
      toast({ title: "Save failed", description: String(err) });
      setBusy(false);
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit stakeholder" : "Add stakeholder"}</DialogTitle>
          <DialogDescription>
            Stakeholders can hold equity, options, SAFEs, or notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sh-name">Name</Label>
              <Input id="sh-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sh-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="sh-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAKEHOLDER_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-email">Email</Label>
            <Input id="sh-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-notes">Notes</Label>
            <Input id="sh-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {!isEdit && (
            <>
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sh-add-holding" className="text-sm">
                      They already own equity
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Issue them shares as part of this add.
                    </p>
                  </div>
                  <Switch
                    id="sh-add-holding"
                    checked={addHolding}
                    onCheckedChange={setAddHolding}
                    disabled={!canAddHolding}
                  />
                </div>
                {!canAddHolding && (
                  <p className="text-xs text-muted-foreground">
                    Add a security class first to enable issuing holdings here.
                  </p>
                )}
                {addHolding && canAddHolding && (
                  <div className="space-y-3 border-l-2 border-primary/30 pl-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Security class</Label>
                      <Select
                        value={holdingClassId}
                        onValueChange={setHoldingClassId}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {securityClasses
                            .filter((c) => c.type !== "OPTION_POOL")
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.name} ({c.type})
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Shares</Label>
                        <Input
                          inputMode="numeric"
                          value={shareCount}
                          onChange={(e) => setShareCount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">$/share (optional)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.0001"
                          value={pricePaid}
                          onChange={(e) => setPricePaid(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Issue date</Label>
                      <Input
                        type="date"
                        value={issueDate}
                        onChange={(e) => setIssueDate(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="sh-add-grant" className="text-sm">
                      They have an option grant
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Default: 4-year vest, 1-year cliff, monthly.
                    </p>
                  </div>
                  <Switch
                    id="sh-add-grant"
                    checked={addGrant}
                    onCheckedChange={setAddGrant}
                  />
                </div>
                {addGrant && (
                  <div className="space-y-3 border-l-2 border-primary/30 pl-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Options</Label>
                        <Input
                          inputMode="numeric"
                          value={optionCount}
                          onChange={(e) => setOptionCount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Strike ($)</Label>
                        <Input
                          inputMode="decimal"
                          placeholder="0.10"
                          value={strikePrice}
                          onChange={(e) => setStrikePrice(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Grant date</Label>
                        <Input
                          type="date"
                          value={grantDate}
                          onChange={(e) => setGrantDate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Vest mo.</Label>
                        <Input
                          inputMode="numeric"
                          value={vestingDuration}
                          onChange={(e) => setVestingDuration(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cliff mo.</Label>
                        <Input
                          inputMode="numeric"
                          value={vestingCliff}
                          onChange={(e) => setVestingCliff(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
