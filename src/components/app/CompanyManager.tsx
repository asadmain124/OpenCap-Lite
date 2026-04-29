"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { useToast } from "@/components/ui/use-toast";
import { api, fetcher } from "@/lib/api/client";

const COMPANY_COOKIE = "opencap.companyId";

interface Company {
  id: string;
  legalName: string;
  jurisdiction: string;
  defaultCurrency: string;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function clearCookie(name: string) {
  document.cookie = `${name}=; path=/; max-age=0; samesite=lax`;
}

export function CompanyManager() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: companies, mutate } = useSWR<Company[]>(
    "/api/companies",
    fetcher,
  );

  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editValue, setEditValue] = React.useState("");
  const [pendingDelete, setPendingDelete] = React.useState<Company | null>(null);
  const [busy, setBusy] = React.useState(false);

  const startEdit = (c: Company) => {
    setEditingId(c.id);
    setEditValue(c.legalName);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (c: Company) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === c.legalName) {
      cancelEdit();
      return;
    }
    setBusy(true);
    try {
      await api.put(`/api/companies/${c.id}`, { legalName: trimmed });
      await mutate();
      toast({ title: "Company renamed" });
      cancelEdit();
      router.refresh();
    } catch (err) {
      toast({
        title: "Rename failed",
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      await api.delete(`/api/companies/${pendingDelete.id}`);
      const activeId = readCookie(COMPANY_COOKIE);
      if (activeId === pendingDelete.id) {
        clearCookie(COMPANY_COOKIE);
      }
      await mutate();
      toast({ title: "Company deleted" });
      setPendingDelete(null);
      router.refresh();
    } catch (err) {
      toast({
        title: "Delete failed",
        description:
          err instanceof Error
            ? err.message
            : "Make sure all stakeholders, holdings, and instruments are removed first.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Companies</CardTitle>
        <CardDescription>
          Rename or remove a company. Add new ones from the dropdown in the
          top-right.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!companies ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : companies.length === 0 ? (
          <p className="text-sm text-muted-foreground">No companies yet.</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {companies.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void saveEdit(c);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        disabled={busy}
                      />
                    ) : (
                      <>
                        <p className="truncate text-sm font-medium">
                          {c.legalName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {c.jurisdiction} · {c.defaultCurrency}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => saveEdit(c)}
                          disabled={busy}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={cancelEdit}
                          disabled={busy}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Rename ${c.legalName}`}
                          onClick={() => startEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${c.legalName}`}
                          onClick={() => setPendingDelete(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {pendingDelete?.legalName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the company and all related data
              (stakeholders, holdings, SAFEs, notes, scenarios). This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
