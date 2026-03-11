import { Progress } from "@/components/ui/progress";

interface RiskMeterProps {
  score: number | null;
}

function getRiskLabel(score: number) {
  if (score < 35) return "Low";
  if (score < 70) return "Medium";
  return "High";
}

function getRiskColor(score: number) {
  if (score < 35) return "text-emerald-400";
  if (score < 70) return "text-amber-400";
  return "text-rose-400";
}

export function RiskMeter({ score }: RiskMeterProps) {
  if (score === null) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
        <p className="text-sm text-zinc-400">Risk meter will appear after scan.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-zinc-300">Rug-Pull Risk Score</p>
        <p className={`text-sm font-semibold ${getRiskColor(score)}`}>
          {score}/100 ({getRiskLabel(score)})
        </p>
      </div>
      <Progress value={score} />
    </div>
  );
}
