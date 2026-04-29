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
import { Badge } from "@/components/ui/badge";
import { DataTable, type RowAction } from "@/components/tables/DataTable";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";

const SAFE_STATUSES = ["OUTSTANDING", "CONVERTED", "CANCELLED"] as const;

interface Row {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  issueDate: string;
  purchaseAmount: string;
  valuationCap: string | null;
  discountPercent: string | null;
  mfn: boolean;
  postMoney: boolean;
  proRataRights: boolean;
  status: string;
}

interface Option {
  id: string;
  name: string;
}

export function SafeTable({
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
      { accessorKey: "stakeholderName", header: "Holder" },
      {
        accessorKey: "purchaseAmount",
        header: "Amount",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(row.original.purchaseAmount)}
          </span>
        ),
      },
      {
        accessorKey: "valuationCap",
        header: "Cap",
        cell: ({ row }) =>
          row.original.valuationCap ? (
            <span className="tabular-nums">
              {formatCurrency(row.original.valuationCap)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "discountPercent",
        header: "Discount",
        cell: ({ row }) =>
          row.original.discountPercent
            ? formatPercent(Number(row.original.discountPercent) / 100, "en-US", 1)
            : "—",
      },
      {
        accessorKey: "postMoney",
        header: "Type",
        cell: ({ row }) => (row.original.postMoney ? "Post-money" : "Pre-money"),
      },
      {
        accessorKey: "mfn",
        header: "MFN",
        cell: ({ row }) =>
          row.original.mfn ? <Badge variant="secondary">MFN</Badge> : "—",
      },
      {
        accessorKey: "issueDate",
        header: "Issued",
        cell: ({ row }) => formatDate(row.original.issueDate),
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
        <p className="text-sm text-muted-foreground">Filter by holder</p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!canCreate}>+ Add SAFE</Button>
          </DialogTrigger>
          <SafeForm
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
          Add a stakeholder before issuing a SAFE.
        </p>
      )}

      <DataTable<Row, unknown>
        columns={columns}
        data={rows}
        filterPlaceholder="Filter by holder..."
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
              Delete SAFE for {confirmDelete?.stakeholderName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the {confirmDelete?.purchaseAmount && formatCurrency(confirmDelete.purchaseAmount)} SAFE.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.delete(`/api/safes/${confirmDelete.id}`);
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

function SafeForm({
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
  const [purchaseAmount, setPurchaseAmount] = React.useState(
    initial?.purchaseAmount ?? "",
  );
  const [valuationCap, setValuationCap] = React.useState(
    initial?.valuationCap ?? "",
  );
  const [discountPercent, setDiscountPercent] = React.useState(
    initial?.discountPercent ?? "",
  );
  const [issueDate, setIssueDate] = React.useState(
    initial?.issueDate
      ? initial.issueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [postMoney, setPostMoney] = React.useState(initial?.postMoney ?? true);
  const [mfn, setMfn] = React.useState(initial?.mfn ?? false);
  const [proRataRights, setProRataRights] = React.useState(
    initial?.proRataRights ?? false,
  );
  const [status, setStatus] = React.useState(initial?.status ?? "OUTSTANDING");
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!stakeholderId || !purchaseAmount) {
      toast({ title: "Holder and amount are required" });
      return;
    }
    if (!valuationCap && !discountPercent && !mfn) {
      toast({
        title: "SAFE must have a cap, a discount, or be marked MFN",
      });
      return;
    }
    setBusy(true);
    try {
      const body = {
        purchaseAmount,
        valuationCap: valuationCap || null,
        discountPercent: discountPercent || null,
        issueDate,
        postMoney,
        mfn,
        proRataRights,
        status,
      };
      if (initial) {
        await api.put(`/api/safes/${initial.id}`, body);
      } else {
        await api.post("/api/safes", {
          companyId,
          stakeholderId,
          ...body,
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
          <DialogTitle>{initial ? "Edit SAFE" : "New SAFE"}</DialogTitle>
          <DialogDescription>
            Simple Agreement for Future Equity. Convert at the next priced
            round, capped or discounted.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="s-holder">Holder</Label>
            <Select
              value={stakeholderId}
              onValueChange={setStakeholderId}
              disabled={!!initial}
            >
              <SelectTrigger id="s-holder">
                <SelectValue placeholder="Select holder" />
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
              <Label htmlFor="s-amount">Amount ($)</Label>
              <Input
                id="s-amount"
                inputMode="decimal"
                required
                value={purchaseAmount}
                onChange={(e) => setPurchaseAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-date">Issue date</Label>
              <Input
                id="s-date"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="s-cap">Valuation cap ($)</Label>
              <Input
                id="s-cap"
                inputMode="decimal"
                placeholder="e.g. 10000000"
                value={valuationCap}
                onChange={(e) => setValuationCap(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-disc">Discount (%)</Label>
              <Input
                id="s-disc"
                inputMode="decimal"
                placeholder="e.g. 20"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="s-pm">Post-money</Label>
              <Switch
                id="s-pm"
                checked={postMoney}
                onCheckedChange={setPostMoney}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="s-mfn">MFN</Label>
              <Switch id="s-mfn" checked={mfn} onCheckedChange={setMfn} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label htmlFor="s-pr">Pro-rata</Label>
              <Switch
                id="s-pr"
                checked={proRataRights}
                onCheckedChange={setProRataRights}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="s-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="s-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {busy ? "Saving…" : initial ? "Save changes" : "Create SAFE"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
