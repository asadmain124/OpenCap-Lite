"use client";

import * as React from "react";
import { ChevronDown, Lightbulb } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ENTITIES, type EntityKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export function EmptyStateLearn({
  entity,
  onPrimary,
  defaultOpen = true,
  className,
}: {
  entity: EntityKey;
  onPrimary?: () => void;
  defaultOpen?: boolean;
  className?: string;
}) {
  const e = ENTITIES[entity];
  const [open, setOpen] = React.useState(defaultOpen);
  if (!e) return null;

  return (
    <Card className={cn("border-dashed", className)}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
              <div>
                <CardTitle className="text-base">{e.title}</CardTitle>
                <CardDescription className="mt-0.5">
                  Quick primer — collapse anytime.
                </CardDescription>
              </div>
            </div>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label={open ? "Collapse" : "Expand"}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    open && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>{e.body}</p>
            {onPrimary && (
              <div>
                <Button size="sm" onClick={onPrimary}>
                  {e.cta}
                </Button>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
