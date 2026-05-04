"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { api } from "@/lib/api/client";
import { cn } from "@/lib/utils";

type Step = "founders" | "pool" | "investors" | "safes" | "review";

interface FounderRow {
  id: string;
  name: string;
  shares: string;
  type: "FOUNDER" | "EMPLOYEE" | "ADVISOR" | "OTHER";
}

interface InvestorRow {
  id: string;
  name: string;
  type: "ANGEL" | "VC" | "ACCELERATOR" | "OTHER";
  shares: string;
  shareClass: "common" | "preferred";
}

interface SafeRow {
  id: string;
  name: string;
  amount: string;
}

const STEPS: { id: Step; label: string }[] = [
  { id: "founders", label: "Founders & team" },
  { id: "pool", label: "Option pool" },
  { id: "investors", label: "Equity investors" },
  { id: "safes", label: "SAFEs" },
  { id: "review", label: "Review" },
];

function rowId() {
  return Math.random().toString(36).slice(2);
}

export function OnboardingWizard({ companyId }: { companyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const [step, setStep] = React.useState<Step>("founders");
  const [submitting, setSubmitting] = React.useState(false);
  const [progress, setProgress] = React.useState<string | null>(null);

  const [founders, setFounders] = React.useState<FounderRow[]>([
    { id: rowId(), name: "Founder 1", shares: "8000000", type: "FOUNDER" },
  ]);
  const [poolShares, setPoolShares] = React.useState("2000000");
  const [investors, setInvestors] = React.useState<InvestorRow[]>([]);
  const [safes, setSafes] = React.useState<SafeRow[]>([]);
  const [safeCap, setSafeCap] = React.useState("10000000");
  const [safeDiscount, setSafeDiscount] = React.useState("");
  const [safePostMoney, setSafePostMoney] = React.useState(true);

  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const goNext = () => {
    if (step === "founders") {
      if (founders.some((f) => !f.name.trim() || !f.shares.trim())) {
        toast({ title: "Each founder needs a name and share count" });
        return;
      }
    }
    setStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)].id);
  };
  const goBack = () => setStep(STEPS[Math.max(stepIndex - 1, 0)].id);

  const finish = async () => {
    setSubmitting(true);
    try {
      // 1. Ensure Common Stock security class exists
      setProgress("Creating Common Stock class…");
      const classes = (
        await api.get<{ data: { id: string; name: string; type: string }[] }>(
          `/api/security-classes?companyId=${companyId}`,
        )
      ).data;
      let commonClass = classes.find((c) => c.type === "COMMON");
      if (!commonClass) {
        const created = await api.post<{
          data: { id: string; name: string; type: string };
        }>("/api/security-classes", {
          companyId,
          name: "Common Stock",
          type: "COMMON",
          seniorityOrder: 0,
          authorizedShares: "20000000",
        });
        commonClass = created.data;
      }

      // 2. Ensure Option Pool exists if poolShares > 0
      let poolClass = classes.find((c) => c.type === "OPTION_POOL");
      const wantsPool = Number(poolShares) > 0;
      if (wantsPool) {
        setProgress("Setting up the option pool…");
        if (!poolClass) {
          const created = await api.post<{
            data: { id: string; type: string };
          }>("/api/security-classes", {
            companyId,
            name: "Option Pool",
            type: "OPTION_POOL",
            seniorityOrder: 1,
            reservedUngrantedShares: poolShares,
          });
          poolClass = { id: created.data.id, name: "Option Pool", type: "OPTION_POOL" };
        } else {
          await api.put(`/api/security-classes/${poolClass.id}`, {
            reservedUngrantedShares: poolShares,
          });
        }
      }

      // 3. Founders / team
      let preferredClass = classes.find((c) => c.type === "PREFERRED");
      for (const f of founders) {
        setProgress(`Adding ${f.name}…`);
        const sh = await api.post<{ data: { id: string } }>(
          "/api/stakeholders",
          {
            companyId,
            name: f.name.trim(),
            type: f.type,
            email: null,
            notes: null,
          },
        );
        await api.post("/api/holdings", {
          companyId,
          stakeholderId: sh.data.id,
          securityClassId: commonClass.id,
          shareCount: f.shares,
          issueDate: new Date().toISOString().slice(0, 10),
          status: "ACTIVE",
        });
      }

      // 4. Investors
      for (const inv of investors) {
        if (!inv.name.trim() || !inv.shares.trim()) continue;
        setProgress(`Adding ${inv.name}…`);
        let classId = commonClass.id;
        if (inv.shareClass === "preferred") {
          if (!preferredClass) {
            const created = await api.post<{
              data: { id: string; name: string; type: string };
            }>("/api/security-classes", {
              companyId,
              name: "Seed Preferred",
              type: "PREFERRED",
              seniorityOrder: 2,
              liquidationPreferenceMultiple: "1",
              authorizedShares: "10000000",
            });
            preferredClass = created.data;
          }
          classId = preferredClass.id;
        }
        const sh = await api.post<{ data: { id: string } }>(
          "/api/stakeholders",
          {
            companyId,
            name: inv.name.trim(),
            type: inv.type,
            email: null,
            notes: null,
          },
        );
        await api.post("/api/holdings", {
          companyId,
          stakeholderId: sh.data.id,
          securityClassId: classId,
          shareCount: inv.shares,
          issueDate: new Date().toISOString().slice(0, 10),
          status: "ACTIVE",
        });
      }

      // 5. SAFEs (one stakeholder + one SAFE per row, shared cap/discount/structure)
      const validSafes = safes.filter((s) => s.name.trim() && Number(s.amount) > 0);
      if (validSafes.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const cap = safeCap.trim() ? safeCap.trim() : null;
        const discount = safeDiscount.trim() ? safeDiscount.trim() : null;
        for (const s of validSafes) {
          setProgress(`Adding ${s.name}…`);
          const sh = await api.post<{ data: { id: string } }>(
            "/api/stakeholders",
            {
              companyId,
              name: s.name.trim(),
              type: "ANGEL",
              email: null,
              notes: null,
            },
          );
          await api.post("/api/safes", {
            companyId,
            stakeholderId: sh.data.id,
            issueDate: today,
            purchaseAmount: s.amount,
            valuationCap: cap,
            discountPercent: discount,
            postMoney: safePostMoney,
            mfn: false,
            proRataRights: false,
            status: "OUTSTANDING",
          });
        }
      }

      setProgress(null);
      toast({ title: "Cap table set up" });
      router.refresh();
    } catch (err) {
      toast({
        title: "Setup failed",
        description: err instanceof Error ? err.message : String(err),
      });
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <CardTitle>Set up your cap table</CardTitle>
        </div>
        <CardDescription>
          Walk through founders, option pool, and existing investors. Skip what
          you don&rsquo;t need — you can always add more later.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="flex flex-wrap gap-2 text-xs">
          {STEPS.map((s, i) => {
            const done = i < stepIndex;
            const current = s.id === step;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1",
                    current && "border-primary bg-primary text-primary-foreground",
                    done && !current && "border-primary/40 text-primary",
                    !current && !done && "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
                      current ? "bg-primary-foreground/20" : "bg-muted",
                      done && "bg-primary text-primary-foreground",
                    )}
                  >
                    {done ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <span className="text-muted-foreground">→</span>
                )}
              </li>
            );
          })}
        </ol>

        {step === "founders" && (
          <FoundersStep founders={founders} setFounders={setFounders} />
        )}
        {step === "pool" && (
          <PoolStep poolShares={poolShares} setPoolShares={setPoolShares} />
        )}
        {step === "investors" && (
          <InvestorsStep investors={investors} setInvestors={setInvestors} />
        )}
        {step === "safes" && (
          <SafesStep
            safes={safes}
            setSafes={setSafes}
            cap={safeCap}
            setCap={setSafeCap}
            discount={safeDiscount}
            setDiscount={setSafeDiscount}
            postMoney={safePostMoney}
            setPostMoney={setSafePostMoney}
          />
        )}
        {step === "review" && (
          <ReviewStep
            founders={founders}
            poolShares={poolShares}
            investors={investors}
            safes={safes}
            safeCap={safeCap}
            safeDiscount={safeDiscount}
            safePostMoney={safePostMoney}
          />
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <Button
            type="button"
            variant="outline"
            onClick={goBack}
            disabled={stepIndex === 0 || submitting}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          {progress && (
            <p className="text-xs text-muted-foreground">{progress}</p>
          )}
          {step === "review" ? (
            <Button onClick={finish} disabled={submitting}>
              {submitting ? "Setting up…" : "Finish setup"}
            </Button>
          ) : (
            <Button onClick={goNext} disabled={submitting}>
              Next <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function FoundersStep({
  founders,
  setFounders,
}: {
  founders: FounderRow[];
  setFounders: React.Dispatch<React.SetStateAction<FounderRow[]>>;
}) {
  const update = (id: string, patch: Partial<FounderRow>) =>
    setFounders((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Founders, employees, and advisors who hold common stock today. We&rsquo;ll
        create a Common Stock class automatically.
      </p>
      {founders.map((f) => (
        <div
          key={f.id}
          className="grid grid-cols-[1fr,140px,160px,40px] gap-2"
        >
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={f.name}
              onChange={(e) => update(f.id, { name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Role</Label>
            <Select
              value={f.type}
              onValueChange={(v) =>
                update(f.id, { type: v as FounderRow["type"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FOUNDER">Founder</SelectItem>
                <SelectItem value="EMPLOYEE">Employee</SelectItem>
                <SelectItem value="ADVISOR">Advisor</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Common shares</Label>
            <Input
              inputMode="numeric"
              value={f.shares}
              onChange={(e) => update(f.id, { shares: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-end"
            onClick={() =>
              setFounders((prev) =>
                prev.length > 1 ? prev.filter((x) => x.id !== f.id) : prev,
              )
            }
            disabled={founders.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setFounders((prev) => [
            ...prev,
            {
              id: rowId(),
              name: `Person ${prev.length + 1}`,
              shares: "",
              type: "FOUNDER",
            },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Add person
      </Button>
    </div>
  );
}

function PoolStep({
  poolShares,
  setPoolShares,
}: {
  poolShares: string;
  setPoolShares: (v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        How many shares to reserve for future employees? Industry-typical is
        10–20% of fully-diluted. Set to 0 to skip.
      </p>
      <div className="space-y-1.5 max-w-xs">
        <Label htmlFor="ow-pool">Reserved option pool (shares)</Label>
        <Input
          id="ow-pool"
          inputMode="numeric"
          value={poolShares}
          onChange={(e) => setPoolShares(e.target.value)}
        />
      </div>
    </div>
  );
}

function InvestorsStep({
  investors,
  setInvestors,
}: {
  investors: InvestorRow[];
  setInvestors: React.Dispatch<React.SetStateAction<InvestorRow[]>>;
}) {
  const update = (id: string, patch: Partial<InvestorRow>) =>
    setInvestors((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    );
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Investors who already hold <em>shares</em> from a prior priced round.
        SAFEs come on the next screen — skip this step if all your investors
        are on SAFEs or notes.
      </p>
      {investors.map((inv) => (
        <div
          key={inv.id}
          className="grid grid-cols-[1fr,120px,140px,140px,40px] gap-2"
        >
          <div className="space-y-1">
            <Label className="text-xs">Name</Label>
            <Input
              value={inv.name}
              onChange={(e) => update(inv.id, { name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={inv.type}
              onValueChange={(v) =>
                update(inv.id, { type: v as InvestorRow["type"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ANGEL">Angel</SelectItem>
                <SelectItem value="VC">VC</SelectItem>
                <SelectItem value="ACCELERATOR">Accelerator</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Shares</Label>
            <Input
              inputMode="numeric"
              value={inv.shares}
              onChange={(e) => update(inv.id, { shares: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Class</Label>
            <Select
              value={inv.shareClass}
              onValueChange={(v) =>
                update(inv.id, { shareClass: v as InvestorRow["shareClass"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="common">Common</SelectItem>
                <SelectItem value="preferred">Preferred</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-end"
            onClick={() =>
              setInvestors((prev) => prev.filter((x) => x.id !== inv.id))
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setInvestors((prev) => [
            ...prev,
            {
              id: rowId(),
              name: "",
              type: "ANGEL",
              shares: "",
              shareClass: "preferred",
            },
          ])
        }
      >
        <Plus className="mr-1 h-4 w-4" /> Add investor
      </Button>
    </div>
  );
}

function SafesStep({
  safes,
  setSafes,
  cap,
  setCap,
  discount,
  setDiscount,
  postMoney,
  setPostMoney,
}: {
  safes: SafeRow[];
  setSafes: React.Dispatch<React.SetStateAction<SafeRow[]>>;
  cap: string;
  setCap: (v: string) => void;
  discount: string;
  setDiscount: (v: string) => void;
  postMoney: boolean;
  setPostMoney: (v: boolean) => void;
}) {
  const update = (id: string, patch: Partial<SafeRow>) =>
    setSafes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  const total = safes.reduce((acc, s) => acc + (Number(s.amount) || 0), 0);
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Outstanding SAFEs that haven&rsquo;t converted yet. All SAFEs in this
        step share the same cap, discount, and structure — you can edit each
        one individually later. Skip if you don&rsquo;t have any.
      </p>
      <div className="grid grid-cols-1 gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-xs">Valuation cap (USD)</Label>
          <Input
            inputMode="numeric"
            placeholder="10000000"
            value={cap}
            onChange={(e) => setCap(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Discount %</Label>
          <Input
            inputMode="numeric"
            placeholder="20"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Structure</Label>
          <Select
            value={postMoney ? "post" : "pre"}
            onValueChange={(v) => setPostMoney(v === "post")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="post">Post-money (YC 2018)</SelectItem>
              <SelectItem value="pre">Pre-money (legacy)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {safes.map((s) => (
        <div key={s.id} className="grid grid-cols-[1fr,160px,40px] gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Investor name</Label>
            <Input
              value={s.name}
              onChange={(e) => update(s.id, { name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Amount (USD)</Label>
            <Input
              inputMode="numeric"
              value={s.amount}
              onChange={(e) => update(s.id, { amount: e.target.value })}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="self-end"
            onClick={() =>
              setSafes((prev) => prev.filter((x) => x.id !== s.id))
            }
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            setSafes((prev) => [
              ...prev,
              { id: rowId(), name: "", amount: "" },
            ])
          }
        >
          <Plus className="mr-1 h-4 w-4" /> Add SAFE investor
        </Button>
        {safes.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Total raised: ${total.toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}

function ReviewStep({
  founders,
  poolShares,
  investors,
  safes,
  safeCap,
  safeDiscount,
  safePostMoney,
}: {
  founders: FounderRow[];
  poolShares: string;
  investors: InvestorRow[];
  safes: SafeRow[];
  safeCap: string;
  safeDiscount: string;
  safePostMoney: boolean;
}) {
  const founderTotal = founders.reduce(
    (acc, f) => acc + (Number(f.shares) || 0),
    0,
  );
  const investorTotal = investors.reduce(
    (acc, i) => acc + (Number(i.shares) || 0),
    0,
  );
  const validSafes = safes.filter((s) => s.name.trim() && Number(s.amount) > 0);
  const safeTotal = validSafes.reduce((acc, s) => acc + Number(s.amount), 0);
  const pool = Number(poolShares) || 0;
  const fd = founderTotal + investorTotal + pool;
  const fmt = (n: number) => n.toLocaleString();

  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted-foreground">
        We&rsquo;ll create the security classes, stakeholders, holdings, and
        SAFEs below. You can edit anything afterwards.
      </p>
      <ul className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
        <li>
          <span className="font-medium">{founders.length} person(s)</span> on
          common stock — {fmt(founderTotal)} shares
        </li>
        <li>
          <span className="font-medium">Option pool</span> —{" "}
          {pool > 0 ? `${fmt(pool)} reserved` : "skipped"}
        </li>
        <li>
          <span className="font-medium">{investors.length} equity investor(s)</span> —{" "}
          {fmt(investorTotal)} shares
        </li>
        <li>
          <span className="font-medium">{validSafes.length} SAFE(s)</span>
          {validSafes.length > 0
            ? ` — $${fmt(safeTotal)} at $${fmt(Number(safeCap) || 0)} ${safePostMoney ? "post-money" : "pre-money"} cap${safeDiscount ? `, ${safeDiscount}% discount` : ""}`
            : " — skipped"}
        </li>
        <li className="border-t pt-1 font-medium">
          Initial fully-diluted (pre-SAFE conversion) ≈ {fmt(fd)}
        </li>
      </ul>
    </div>
  );
}
