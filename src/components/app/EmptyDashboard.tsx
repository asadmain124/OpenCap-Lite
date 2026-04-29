"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { NewCompanyDialog } from "./NewCompanyDialog";

const COMPANY_COOKIE = "opencap.companyId";

function writeCookie(name: string, value: string) {
  const oneYear = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${oneYear}; samesite=lax`;
}

export function EmptyDashboard() {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Create your first company</CardTitle>
          <CardDescription>
            Each company gets its own cap table, stakeholders, SAFEs, notes, and
            scenarios. You can switch between companies from the dropdown in the
            top-right.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            New company
          </Button>
        </CardContent>
      </Card>

      <NewCompanyDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={async (id) => {
          writeCookie(COMPANY_COOKIE, id);
          setOpen(false);
          toast({ title: "Company created" });
          router.refresh();
        }}
      />
    </div>
  );
}
