import { getPrimaryCompanyId } from "@/lib/company-context";
import { loadSerializedBaseline } from "@/lib/baseline";
import { ScenarioBuilder } from "@/components/scenario/ScenarioBuilder";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function NewScenarioPage() {
  const companyId = await getPrimaryCompanyId();
  const baseline = companyId ? await loadSerializedBaseline(companyId) : null;

  if (!companyId || !baseline) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">New Scenario</h1>
        <Card>
          <CardHeader>
            <CardTitle>No company found</CardTitle>
            <CardDescription>Create a company on the Settings page before building a scenario.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Scenario</h1>
        <p className="text-sm text-muted-foreground">
          Using {baseline.companyName}&rsquo;s current cap table as the baseline.
        </p>
      </div>
      <ScenarioBuilder companyId={companyId} baseline={baseline} />
    </div>
  );
}
