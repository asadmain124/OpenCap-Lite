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
import { formatShares } from "@/lib/formatters";

const SECURITY_TYPES = [
  "COMMON",
  "PREFERRED",
  "OPTION_POOL",
  "WARRANT",
  "LLC_UNIT",
  "OTHER",
] as const;

interface Row {
  id: string;
  name: string;
  type: string;
  seniorityOrder: number;
  authorizedShares: string | null;
  reservedUngrantedShares: string | null;
  liquidationPreferenceMultiple: string | null;
  participationRights: boolean;
}

export function SecurityClassTable({
  companyId,
  rows,
}: {
  companyId: string | null;
  rows: Row[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Row | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<Row | null>(null);

  const columns = React.useMemo<ColumnDef<Row, unknown>[]>(
    () => [
      { accessorKey: "name", header: "Name" },
      {
        accessorKey: "type",
        header: "Type",
        cell: ({ row }) => (
          <Badge variant="secondary">{row.original.type}</Badge>
        ),
      },
      {
        accessorKey: "authorizedShares",
        header: "Authorized",
        cell: ({ row }) =>
          row.original.authorizedShares ? (
            <span className="tabular-nums">
              {formatShares(row.original.authorizedShares)}
            </span>
          ) : (
            "—"
          ),
      },
      {
        accessorKey: "reservedUngrantedShares",
        header: "Reserved pool",
        cell: ({ row }) =>
          row.original.reservedUngrantedShares ? (
            <span className="tabular-nums">
              {formatShares(row.original.reservedUngrantedShares)}
            </span>
          ) : (
            "—"
          ),
      },
      { accessorKey: "seniorityOrder", header: "Seniority" },
      {
        accessorKey: "liquidationPreferenceMultiple",
        header: "Liq pref",
        cell: ({ row }) =>
          row.original.liquidationPreferenceMultiple
            ? `${row.original.liquidationPreferenceMultiple}x`
            : "—",
      },
      {
        accessorKey: "participationRights",
        header: "Participation",
        cell: ({ row }) => (row.original.participationRights ? "Yes" : "No"),
      },
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Filter by name</p>
        <Dialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={!companyId}>+ Add security class</Button>
          </DialogTrigger>
          <SecurityClassForm
            key={editing?.id ?? "new"}
            companyId={companyId}
            initial={editing}
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
        filterColumnId="name"
        renderRowActions={actions}
      />

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete &ldquo;{confirmDelete?.name}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Holdings issued against this class must be deleted first.
              Otherwise the delete will fail with a foreign-key error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!confirmDelete) return;
                try {
                  await api.delete(
                    `/api/security-classes/${confirmDelete.id}`,
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

function SecurityClassForm({
  companyId,
  initial,
  onClose,
}: {
  companyId: string | null;
  initial: Row | null;
  onClose: (refresh: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState(initial?.type ?? "COMMON");
  const [seniorityOrder, setSeniorityOrder] = React.useState(
    String(initial?.seniorityOrder ?? 0),
  );
  const [authorizedShares, setAuthorizedShares] = React.useState(
    initial?.authorizedShares ?? "",
  );
  const [reservedUngrantedShares, setReservedUngrantedShares] = React.useState(
    initial?.reservedUngrantedShares ?? "",
  );
  const [liquidationPreferenceMultiple, setLiquidationPreferenceMultiple] =
    React.useState(initial?.liquidationPreferenceMultiple ?? "");
  const [participationRights, setParticipationRights] = React.useState(
    initial?.participationRights ?? false,
  );
  const [busy, setBusy] = React.useState(false);

  const isPool = type === "OPTION_POOL";
  const isPreferred = type === "PREFERRED";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    if (!name.trim()) {
      toast({ title: "Name is required" });
      return;
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        type,
        seniorityOrder: Number(seniorityOrder) || 0,
        authorizedShares: authorizedShares || null,
        reservedUngrantedShares: isPool
          ? reservedUngrantedShares || "0"
          : null,
        liquidationPreferenceMultiple: isPreferred
          ? liquidationPreferenceMultiple || null
          : null,
        participationRights: isPreferred ? participationRights : false,
      };
      if (initial) {
        await api.put(`/api/security-classes/${initial.id}`, body);
      } else {
        await api.post("/api/security-classes", { companyId, ...body });
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
            {initial ? "Edit security class" : "New security class"}
          </DialogTitle>
          <DialogDescription>
            Common stock, preferred series, an option pool, or a warrant.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-name">Name</Label>
              <Input
                id="sc-name"
                required
                placeholder="e.g. Common Stock"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-type">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="sc-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECURITY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sc-auth">Authorized shares</Label>
              <Input
                id="sc-auth"
                inputMode="numeric"
                placeholder="optional"
                value={authorizedShares}
                onChange={(e) => setAuthorizedShares(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sc-sen">Seniority (lower = junior)</Label>
              <Input
                id="sc-sen"
                inputMode="numeric"
                value={seniorityOrder}
                onChange={(e) => setSeniorityOrder(e.target.value)}
              />
            </div>
          </div>
          {isPool && (
            <div className="space-y-1.5">
              <Label htmlFor="sc-pool">Reserved (ungranted) pool</Label>
              <Input
                id="sc-pool"
                inputMode="numeric"
                placeholder="0"
                value={reservedUngrantedShares}
                onChange={(e) => setReservedUngrantedShares(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Shares set aside but not yet granted. Counted in fully-diluted.
              </p>
            </div>
          )}
          {isPreferred && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sc-lp">Liquidation preference (×)</Label>
                <Input
                  id="sc-lp"
                  inputMode="decimal"
                  placeholder="1"
                  value={liquidationPreferenceMultiple}
                  onChange={(e) =>
                    setLiquidationPreferenceMultiple(e.target.value)
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <Label htmlFor="sc-part">Participating</Label>
                <Switch
                  id="sc-part"
                  checked={participationRights}
                  onCheckedChange={setParticipationRights}
                />
              </div>
            </div>
          )}
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
            {busy ? "Saving…" : initial ? "Save changes" : "Create"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
