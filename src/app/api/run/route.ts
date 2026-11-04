import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";
import type { PipelineConfig } from "@/lib/types";

const num = (v: unknown, d: number, lo: number, hi: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
};

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const cfg: PipelineConfig = {
    featureSelection: !!b.featureSelection,
    predictor: !!b.predictor,
    scheduler: !!b.scheduler,
    seed: num(b.seed, 42, 0, 1_000_000),
    numTasks: num(b.numTasks, 200, 10, 400),
    numVMs: num(b.numVMs, 5, 2, 20),
  };

  // Once your Python service exists, set LAYER_BACKEND_URL and runs are forwarded to it.
  const remote = process.env.LAYER_BACKEND_URL;
  if (remote) {
    const r = await fetch(`${remote}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cfg),
    });
    if (!r.ok) return NextResponse.json({ error: "Layer backend failed" }, { status: 502 });
    return NextResponse.json(await r.json());
  }
  return NextResponse.json(runPipeline(cfg));
}
