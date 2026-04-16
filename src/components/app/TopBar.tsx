"use client";

import * as React from "react";
import Link from "next/link";
import { Settings as SettingsIcon } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Company {
  id: string;
  name: string;
}

// Placeholder list; in a later layer this is fetched from the server.
const MOCK_COMPANIES: Company[] = [{ id: "acme", name: "Acme Labs, Inc." }];

export function TopBar() {
  const [selectedCompany, setSelectedCompany] = React.useState<string>(
    MOCK_COMPANIES[0]?.id ?? "",
  );

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4">
      <Link
        href="/"
        className="text-lg font-semibold tracking-tight"
      >
        OpenCap Lite
      </Link>
      <div className="ml-auto flex items-center gap-2">
        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-[220px]" aria-label="Select company">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {MOCK_COMPANIES.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
    </header>
  );
}
