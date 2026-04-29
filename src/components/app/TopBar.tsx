"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Plus, Settings as SettingsIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fetcher } from "@/lib/api/client";
import { NewCompanyDialog } from "./NewCompanyDialog";

const COMPANY_COOKIE = "opencap.companyId";
const NEW_COMPANY_VALUE = "__new__";

interface Company {
  id: string;
  legalName: string;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function TopBar() {
  const router = useRouter();
  const { toast } = useToast();
  const { data: companies, mutate } = useSWR<Company[]>(
    "/api/companies",
    fetcher,
  );

  const [overrideId, setOverrideId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const selectedId = React.useMemo(() => {
    if (!companies || companies.length === 0) return "";
    if (overrideId && companies.some((c) => c.id === overrideId)) return overrideId;
    const cookieId = readCookie(COMPANY_COOKIE);
    if (cookieId && companies.some((c) => c.id === cookieId)) return cookieId;
    return companies[0].id;
  }, [companies, overrideId]);

  const onSelect = (value: string) => {
    if (value === NEW_COMPANY_VALUE) {
      setDialogOpen(true);
      return;
    }
    setOverrideId(value);
    writeCookie(COMPANY_COOKIE, value);
    router.refresh();
  };

  const onCreated = async (newId: string) => {
    writeCookie(COMPANY_COOKIE, newId);
    setOverrideId(newId);
    await mutate();
    setDialogOpen(false);
    toast({ title: "Company created" });
    router.refresh();
  };

  const hasCompanies = (companies?.length ?? 0) > 0;
  const showSelect = hasCompanies && selectedId !== "";

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
      <Link
        href="/"
        className="text-lg font-semibold tracking-tight"
      >
        OpenCap Lite
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {showSelect ? (
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="w-[240px]" aria-label="Select company">
              <SelectValue placeholder="Select company" />
            </SelectTrigger>
            <SelectContent>
              {companies!.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.legalName}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value={NEW_COMPANY_VALUE}>
                + New company…
              </SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New company
          </Button>
        )}
        <Button
          asChild
          variant="ghost"
          size="icon"
          aria-label="Open settings"
        >
          <Link href="/settings">
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      <NewCompanyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={onCreated}
      />
    </header>
  );
}
