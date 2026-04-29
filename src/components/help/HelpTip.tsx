"use client";

import * as React from "react";
import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { TERMS, type TermKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export function HelpTip({
  term,
  className,
}: {
  term: TermKey;
  className?: string;
}) {
  const entry = TERMS[term];
  if (!entry) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${entry.label}?`}
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            className,
          )}
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="text-sm" align="start">
        <p className="font-medium">{entry.label}</p>
        <p className="mt-1.5 text-muted-foreground">{entry.short}</p>
      </PopoverContent>
    </Popover>
  );
}
