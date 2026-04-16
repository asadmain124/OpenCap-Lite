interface ScenarioDetailPageProps {
  params: { id: string };
}

export default function ScenarioDetailPage({
  params,
}: ScenarioDetailPageProps) {
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold tracking-tight">
        Scenario: {params.id}
      </h1>
      {/* built in a later layer */}
    </div>
  );
}
