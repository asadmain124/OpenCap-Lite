"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  Layers,
  FlaskConical,
  Settings as SettingsIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface NavLink {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  children?: NavLink[];
}

const NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "Cap Table",
    href: "/cap-table",
    icon: Layers,
    children: [
      { label: "Ownership", href: "/cap-table/ownership" },
      { label: "Stakeholders", href: "/cap-table/stakeholders" },
      { label: "Holdings", href: "/cap-table/holdings" },
      { label: "Option Grants", href: "/cap-table/option-grants" },
      { label: "SAFEs", href: "/cap-table/safes" },
      { label: "Notes", href: "/cap-table/notes" },
      { label: "Security Classes", href: "/cap-table/security-classes" },
    ],
  },
  {
    label: "Scenarios",
    href: "/scenarios",
    icon: FlaskConical,
  },
  {
    label: "Settings",
    href: "/settings",
    icon: SettingsIcon,
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname() ?? "/";

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-muted/30 md:block">
      <nav className="sticky top-14 flex flex-col gap-1 p-3">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          if (!item.children) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          }
          const sectionActive = active;
          return (
            <CapTableSection
              key={item.href}
              item={item}
              sectionActive={sectionActive}
              pathname={pathname}
            />
          );
        })}
      </nav>
    </aside>
  );
}

function CapTableSection({
  item,
  sectionActive,
  pathname,
}: {
  item: NavItem;
  sectionActive: boolean;
  pathname: string;
}) {
  const [open, setOpen] = React.useState(sectionActive);
  const Icon = item.icon;

  React.useEffect(() => {
    if (sectionActive) setOpen(true);
  }, [sectionActive]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
          sectionActive && "bg-accent text-accent-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>
      {open && item.children && (
        <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l pl-2">
          {item.children.map((child) => {
            const childActive = isActive(pathname, child.href);
            return (
              <Link
                key={child.href}
                href={child.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  childActive &&
                    "bg-accent font-medium text-accent-foreground",
                )}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
