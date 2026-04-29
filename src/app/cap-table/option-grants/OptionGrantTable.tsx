"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, formatShares } from "@/lib/formatters";

const STATUSES = ["ACTIVE", "CANCELLED", "EXPIRED"] as const;
const VESTING_FREQS = ["NONE", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;

interface Row {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  optionCount: string;
  exercisedCount: string;
  cancelledCount: string;
  strikePrice: string;
  grantDate: string;
  expirationDate: string | null;
  status: string;
  vestingStartDate: string | null;
  vestingCliffMonths: number | null;
  vestingDurationMonths: number | null;
  vestingFrequency: string;
}

interface Option {
  id: string;
  name: string;
}

export function OptionGrantTable({
  companyId,
  rows,
  stakeholders,
}: {
  companyId: string | null;
  rows: Row[];
  stakeholders: Option[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "stakeholderName", header: "Grantee" },
      {
        accessorKey: "optionCount",
        header: "Granted",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatShares(row.original.optionCount)}
          </span>
        ),
      },
      {
        accessorKey: "exercisedCount",
        header: "Exercised",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatShares(row.original.exercisedCount)}
          </span>
        ),
      },
      {
        accessorKey: "cancelledCount",
        header: "Cancelled",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatShares(row.original.cancelledCount)}
          </span>
        ),
      },
      {
        accessorKey: "strikePrice",
        header: "Strike",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(row.original.strikePrice, "USD", "en-US", 4)}
          </span>
        ),
      },
      {
        accessorKey: "grantDate",
        header: "Granted",
        cell: ({ row }) => formatDate(row.original.grantDate),
      },
      {
        accessorKey: "vestingFrequency",
        header: "Vesting",
        cell: ({ row }) =>
          row.original.vestingDurationMonths
            ? `${row.original.vestingDurationMonths}mo / ${row.original.vestingCliffMonths ?? 0}mo cliff`
            : "—",
      },
      { accessorKey: "status", header: "Status" },
    ],
    [],
  );

  const actions = (row: Row): RowAction<Row>[] => [
    {
      label: "Edit",
      onSelect: () => {
        setEditing(row);
        setDialogOpen(true);
      },
    },
    {
      label: "Delete",
      destructive: true,
      onSelect: () => setConfirmDelete(row),
    },
  ];

  const canCreate = companyId != null && stakeholders.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter by grantee</p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!canCreate}>+ Grant options</Button>
          </DialogTrigger>
          <OptionGrantForm
            key={editing?.id ?? "new"}
            companyId={companyId}
            initial={editing}
            stakeholders={stakeholders}
            onClose={(refresh) => {
              setDialogOpen(false);
              setEditing(null);
              if (refresh) router.refresh();
            }}
          />
        </Dialog>
      </div>

      {!canCreate && (
        <p className="text-xs text-muted-foreground">
          Add a stakeholder before granting options.
        </p>
      )}

      <DataTable<Row, unknown>
        columns={columns}
        data={rows}
        filterPlaceholder="Filter by grantee..."
        filterColumnId="stakeholderName"
        renderRowActions={actions}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete this option grant for {confirmDelete?.stakeholderName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Removes {confirmDelete?.optionCount && formatShares(confirmDelete.optionCount)}{" "}
              granted options. Cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.delete(
                    `/api/option-grants/${confirmDelete.id}`,
                  );
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

function OptionGrantForm({
  companyId,
  initial,
  stakeholders,
  onClose,
}: {
  companyId: string | null;
  initial: Row | null;
  stakeholders: Option[];
  onClose: (refresh: boolean) => void;
}) {
  const { toast } = useToast();
  const [stakeholderId, setStakeholderId] = React.useState(
    initial?.stakeholderId ?? stakeholders[0]?.id ?? "",
  );
  const [optionCount, setOptionCount] = React.useState(initial?.optionCount ?? "");
  const [exercisedCount, setExercisedCount] = React.useState(
    initial?.exercisedCount ?? "0",
  );
  const [cancelledCount, setCancelledCount] = React.useState(
    initial?.cancelledCount ?? "0",
  );
  const [strikePrice, setStrikePrice] = React.useState(initial?.strikePrice ?? "");
  const [grantDate, setGrantDate] = React.useState(
    initial?.grantDate
      ? initial.grantDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = React.useState(initial?.status ?? "ACTIVE");
  const [vestingDurationMonths, setVestingDurationMonths] = React.useState(
    initial?.vestingDurationMonths != null
      ? String(initial.vestingDurationMonths)
      : "48",
  );
  const [vestingCliffMonths, setVestingCliffMonths] = React.useState(
    initial?.vestingCliffMonths != null
      ? String(initial.vestingCliffMonths)
      : "12",
  );
  const [vestingFrequency, setVestingFrequency] = React.useState(
    initial?.vestingFrequency ?? "MONTHLY",
  );
  const [vestingStartDate, setVestingStartDate] = React.useState(
    initial?.vestingStartDate
      ? initial.vestingStartDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!stakeholderId || !optionCount || !strikePrice) {
      toast({ title: "Grantee, options, and strike price are required" });
      return;
    }
    setBusy(true);
    try {
      const vesting =
        vestingFrequency === "NONE"
          ? undefined
          : {
              vestingStartDate,
              vestingCliffMonths: Number(vestingCliffMonths) || 0,
              vestingDurationMonths: Number(vestingDurationMonths) || 0,
              vestingFrequency,
            };
      if (initial) {
        await api.put(`/api/option-grants/${initial.id}`, {
          optionCount,
          exercisedCount,
          cancelledCount,
          strikePrice,
          grantDate,
          status,
          vesting,
        });
      } else {
        await api.post("/api/option-grants", {
          companyId,
          stakeholderId,
          optionCount,
          exercisedCount,
          cancelledCount,
          strikePrice,
          grantDate,
          status,
          vesting,
        });
      }
      onClose(true);
    } catch (err) {
      toast({ title: "Save failed", description: String(err) });
      setBusy(false);
    }
  };

  return (
    <DialogContent>
      <form onSubmit={submit}>
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit option grant" : "Grant options"}
          </DialogTitle>
          <DialogDescription>
            Stock options awarded to an employee, advisor, or contractor.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="g-sh">Grantee</Label>
            <Select
              value={stakeholderId}
              onValueChange={setStakeholderId}
              disabled={!!initial}
            >
              <SelectTrigger id="g-sh">
                <SelectValue placeholder="Select grantee" />
              </SelectTrigger>
              <SelectContent>
                {stakeholders.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-opt">Options granted</Label>
              <Input
                id="g-opt"
                inputMode="numeric"
                required
                value={optionCount}
                onChange={(e) => setOptionCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-strike">Strike price ($)</Label>
              <Input
                id="g-strike"
                inputMode="decimal"
                required
                placeholder="0.10"
                value={strikePrice}
                onChange={(e) => setStrikePrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-date">Grant date</Label>
              <Input
                id="g-date"
                type="date"
                required
                value={grantDate}
                onChange={(e) => setGrantDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="g-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="g-ex">Exercised</Label>
              <Input
                id="g-ex"
                inputMode="numeric"
                value={exercisedCount}
                onChange={(e) => setExercisedCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-can">Cancelled</Label>
              <Input
                id="g-can"
                inputMode="numeric"
                value={cancelledCount}
                onChange={(e) => setCancelledCount(e.target.value)}
              />
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 space-y-3">
            <p className="text-xs font-medium">Vesting</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="g-vf" className="text-xs">Frequency</Label>
                <Select
                  value={vestingFrequency}
                  onValueChange={setVestingFrequency}
                >
                  <SelectTrigger id="g-vf">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VESTING_FREQS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-vstart" className="text-xs">Start date</Label>
                <Input
                  id="g-vstart"
                  type="date"
                  value={vestingStartDate}
                  onChange={(e) => setVestingStartDate(e.target.value)}
                  disabled={vestingFrequency === "NONE"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-vd" className="text-xs">Duration (months)</Label>
                <Input
                  id="g-vd"
                  inputMode="numeric"
                  value={vestingDurationMonths}
                  onChange={(e) => setVestingDurationMonths(e.target.value)}
                  disabled={vestingFrequency === "NONE"}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="g-vc" className="text-xs">Cliff (months)</Label>
                <Input
                  id="g-vc"
                  inputMode="numeric"
                  value={vestingCliffMonths}
                  onChange={(e) => setVestingCliffMonths(e.target.value)}
                  disabled={vestingFrequency === "NONE"}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onClose(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Saving…" : initial ? "Save changes" : "Grant"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
