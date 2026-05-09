import { Card } from "@/shared/ui/card";
import { Target } from "@phosphor-icons/react/dist/ssr";

export default function GoalsPage() {
  return (
    <div>
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 text-xs text-[rgb(var(--muted))]">
          <Target size={14} weight="duotone" />
          Planning
        </div>

        <h1 className="text-4xl font-semibold tracking-[-0.055em]">Goals</h1>
      </div>

      <Card className="p-8">
        <div className="max-w-xl">
          <h2 className="text-2xl font-semibold tracking-[-0.04em]">
            Goals will turn tracking into direction
          </h2>
          <p className="mt-3 leading-7 text-[rgb(var(--muted))]">
            Savings targets, runway goals, business milestones and AI planning
            will live here.
          </p>
        </div>
      </Card>
    </div>
  );
}