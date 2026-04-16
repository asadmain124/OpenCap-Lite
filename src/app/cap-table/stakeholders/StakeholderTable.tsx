"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const STAKEHOLDER_TYPES = [
  "FOUNDER",
  "EMPLOYEE",
  "ADVISOR",
  "ANGEL",
  "VC",
  "ACCELERATOR",
  "OTHER",
] as const;

export function StakeholderTable({ companyId, rows }: { companyId: string | null; rows: Row[] }) {
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
            <Button>+ Add Stakeholder</Button>
          </DialogTrigger>
          <StakeholderForm
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
        renderRowActions={actions}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the stakeholder. Related records (holdings, grants, instruments)
              must be deleted first.
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
  onClose,
}: {
  companyId: string | null;
  initial: Row | null;
  onClose: (refresh: boolean) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [type, setType] = React.useState(initial?.type ?? "EMPLOYEE");
  const [email, setEmail] = React.useState(initial?.email ?? "");
  const [notes, setNotes] = React.useState(initial?.notes ?? "");
  const [busy, setBusy] = React.useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    setBusy(true);
    try {
      if (initial) {
        await api.put(`/api/stakeholders/${initial.id}`, {
          name,
          type,
          email: email || null,
          notes: notes || null,
        });
      } else {
        await api.post("/api/stakeholders", {
          companyId,
          name,
          type,
          email: email || null,
          notes: notes || null,
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
      <form onSubmit={onSubmit}>
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Stakeholder" : "New Stakeholder"}</DialogTitle>
          <DialogDescription>
            Stakeholders can hold equity, options, SAFEs, or notes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-4">
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
          <div className="space-y-1.5">
            <Label htmlFor="sh-email">Email</Label>
            <Input id="sh-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sh-notes">Notes</Label>
            <Input id="sh-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose(false)} disabled={busy}>
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
