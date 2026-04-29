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
import { HelpTip } from "@/components/help/HelpTip";

const HOLDING_STATUSES = [
  "ACTIVE",
  "REPURCHASED",
  "TRANSFERRED",
  "CANCELLED",
] as const;

interface Row {
  id: string;
  stakeholderId: string;
  stakeholderName: string;
  securityClassId: string;
  securityClassName: string;
  shareCount: string;
  pricePaidPerShare: string | null;
  issueDate: string;
  status: string;
  certificateNumber: string | null;
  notes: string | null;
}

interface Option {
  id: string;
  name: string;
}

export function HoldingTable({
  companyId,
  rows,
  stakeholders,
  securityClasses,
  baselineFD,
}: {
  companyId: string | null;
  rows: Row[];
  stakeholders: Option[];
  securityClasses: Option[];
  baselineFD: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "stakeholderName", header: "Stakeholder" },
      { accessorKey: "securityClassName", header: "Security class" },
      {
        accessorKey: "shareCount",
        header: "Shares",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatShares(row.original.shareCount)}
          </span>
        ),
      },
      {
        accessorKey: "pricePaidPerShare",
        header: "$/Share",
        cell: ({ row }) =>
          row.original.pricePaidPerShare ? (
            <span className="tabular-nums">
              {formatCurrency(
                row.original.pricePaidPerShare,
                "USD",
                "en-US",
                4,
              )}
            </span>
          ) : (
            "—"
          ),
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

  const canCreate =
    companyId != null && stakeholders.length > 0 && securityClasses.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter by stakeholder</p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!canCreate}>+ Issue holding</Button>
          </DialogTrigger>
          <HoldingForm
            key={editing?.id ?? "new"}
            companyId={companyId}
            initial={editing}
            stakeholders={stakeholders}
            securityClasses={securityClasses}
            baselineFD={baselineFD}
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
          Add at least one stakeholder and one security class first.
        </p>
      )}

      <DataTable<Row, unknown>
        columns={columns}
        data={rows}
        filterPlaceholder="Filter by stakeholder..."
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
              Delete this holding for {confirmDelete?.stakeholderName}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {confirmDelete?.shareCount && formatShares(confirmDelete.shareCount)} shares
              of {confirmDelete?.securityClassName}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.delete(`/api/holdings/${confirmDelete.id}`);
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

function HoldingForm({
  companyId,
  initial,
  stakeholders,
  securityClasses,
  baselineFD,
  onClose,
}: {
  companyId: string | null;
  initial: Row | null;
  stakeholders: Option[];
  securityClasses: Option[];
  baselineFD: string;
  onClose: (refresh: boolean) => void;
}) {
  const { toast } = useToast();
  const [stakeholderId, setStakeholderId] = React.useState(
    initial?.stakeholderId ?? stakeholders[0]?.id ?? "",
  );
  const [securityClassId, setSecurityClassId] = React.useState(
    initial?.securityClassId ?? securityClasses[0]?.id ?? "",
  );
  const [shareCount, setShareCount] = React.useState(initial?.shareCount ?? "");
  const [pricePaidPerShare, setPricePaidPerShare] = React.useState(
    initial?.pricePaidPerShare ?? "",
  );
  const [issueDate, setIssueDate] = React.useState(
    initial?.issueDate
      ? initial.issueDate.slice(0, 10)
      : new Date().toISOString().slice(0, 10),
  );
  const [status, setStatus] = React.useState(initial?.status ?? "ACTIVE");
  const [certificateNumber, setCertificateNumber] = React.useState(
    initial?.certificateNumber ?? "",
  );
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!stakeholderId || !securityClassId || !shareCount) {
      toast({ title: "Stakeholder, security class, and shares are required" });
      return;
    }
    setBusy(true);
    try {
      if (initial) {
        await api.put(`/api/holdings/${initial.id}`, {
          shareCount,
          pricePaidPerShare: pricePaidPerShare || null,
          issueDate,
          status,
          certificateNumber: certificateNumber || null,
        });
      } else {
        await api.post("/api/holdings", {
          companyId,
          stakeholderId,
          securityClassId,
          shareCount,
          pricePaidPerShare: pricePaidPerShare || null,
          issueDate,
          status,
          certificateNumber: certificateNumber || null,
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
            {initial ? "Edit holding" : "Issue new holding"}
          </DialogTitle>
          <DialogDescription>
            Issue a stock certificate to a stakeholder.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="space-y-1.5">
            <Label htmlFor="h-sh">Stakeholder</Label>
            <Select
              value={stakeholderId}
              onValueChange={setStakeholderId}
              disabled={!!initial}
            >
              <SelectTrigger id="h-sh">
                <SelectValue placeholder="Select stakeholder" />
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
          <div className="space-y-1.5">
            <Label htmlFor="h-sc" className="flex items-center gap-1.5">
              Security class
              <HelpTip term="security_class" />
            </Label>
            <Select
              value={securityClassId}
              onValueChange={setSecurityClassId}
              disabled={!!initial}
            >
              <SelectTrigger id="h-sc">
                <SelectValue placeholder="Select security class" />
              </SelectTrigger>
              <SelectContent>
                {securityClasses.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="h-shares">Shares</Label>
              <Input
                id="h-shares"
                inputMode="numeric"
                required
                value={shareCount}
                onChange={(e) => setShareCount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-price">$/share</Label>
              <Input
                id="h-price"
                inputMode="decimal"
                placeholder="0.0001"
                value={pricePaidPerShare}
                onChange={(e) => setPricePaidPerShare(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="h-date">Issue date</Label>
              <Input
                id="h-date"
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="h-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLDING_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-cert">Certificate number (optional)</Label>
            <Input
              id="h-cert"
              value={certificateNumber}
              onChange={(e) => setCertificateNumber(e.target.value)}
            />
          </div>
          <HoldingPreview baselineFD={baselineFD} shareCount={shareCount} />
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
            {busy ? "Saving…" : initial ? "Save changes" : "Issue"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function HoldingPreview({
  baselineFD,
  shareCount,
}: {
  baselineFD: string;
  shareCount: string;
}) {
  const fd = Number(baselineFD || "0");
  const n = Number(shareCount || "0");
  if (fd <= 0) return null;
  const valid = Number.isFinite(n) && n > 0;
  const postFD = fd + (valid ? n : 0);
  const pct = valid && postFD > 0 ? (n / postFD) * 100 : 0;
  return (
    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
      <p className="text-muted-foreground">
        Current fully-diluted:{" "}
        <span className="font-medium tabular-nums text-foreground">
          {formatShares(fd)}
        </span>{" "}
        shares
      </p>
      {valid && (
        <p className="mt-1 text-muted-foreground">
          After this issuance →{" "}
          <span className="font-medium tabular-nums text-foreground">
            {formatShares(postFD)}
          </span>
          {" · "}this holding ≈{" "}
          <span className="font-medium tabular-nums text-foreground">
            {pct.toFixed(2)}%
          </span>{" "}
          of post-issue FD
        </p>
      )}
    </div>
  );
}
