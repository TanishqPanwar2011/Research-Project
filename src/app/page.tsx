"use client";
import { useCallback, useEffect, useState } from "react";
import LayerSwitch from "@/components/LayerSwitch";
import LineChart from "@/components/LineChart";
import { ensureSession, supabase } from "@/lib/supabase";
import { FEATURES, HistoryRow, PipelineConfig, RunResult, comboLabel } from "@/lib/types";

const DEFAULT: PipelineConfig = { featureSelection: true, predictor: true, scheduler: true, seed: 42, numTasks: 200, numVMs: 5 };
const COMBOS = Array.from({ length: 8 }, (_, n) => ({ featureSelection: !!(n & 1), predictor: !!(n & 2), scheduler: !!(n & 4) }));

async function callRun(cfg: PipelineConfig): Promise<RunResult> {
  const r = await fetch("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cfg) });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "Run failed");
  return r.json();
}

const Kpi = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <div className="text-xl font-semibold tabular-nums">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);

export default function Home() {
  const [cfg, setCfg] = useState<PipelineConfig>(DEFAULT);
  const [result, setResult] = useState<RunResult | null>(null);
  const [compare, setCompare] = useState<RunResult[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = <K extends keyof PipelineConfig>(k: K, v: PipelineConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase.from("runs").select("id,created_at,label,result").order("created_at", { ascending: false }).limit(10);
    if (error) setErr("Supabase: " + error.message);
    else setHistory(data as HistoryRow[]);
  }, []);

  useEffect(() => {
    ensureSession().then(loadHistory).catch((e) => setErr("Supabase: " + e.message));
  }, [loadHistory]);

  async function run() {
    setBusy(true); setErr("");
    try {
      const r = await callRun(cfg);
      setResult(r);
      const { error } = await supabase.from("runs").insert({ label: comboLabel(r.config), config: r.config, result: r });
      if (error) setErr("Run worked but was not saved: " + error.message);
      await loadHistory();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function runAll() {
    setBusy(true); setErr("");
    try { setCompare(await Promise.all(COMBOS.map((c) => callRun({ ...cfg, ...c })))); }
    catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  async function remove(id: string) {
    await supabase.from("runs").delete().eq("id", id);
    loadHistory();
  }

  const hint =
    cfg.featureSelection && !cfg.predictor ? "Layer 1 has no visible effect while Layer 2 is off, because it only feeds the predictor."
    : cfg.predictor && !cfg.scheduler ? "Forecasts are computed, but nothing uses them while Layer 3 is off."
    : "";
  const baseline = compare.find((r) => !r.config.featureSelection && !r.config.predictor && !r.config.scheduler);
  const bestMk = compare.length ? Math.min(...compare.map((r) => r.metrics.makespan)) : 0;
  const inp = "w-24 rounded-lg border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">SLADRO Lab</h1>
          <p className="text-slate-600 dark:text-slate-400">Switch layers on or off and compare how the combination changes the result.</p>
        </header>

        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
          The three layers are placeholders for now (correlation filter, linear regression, earliest-finish rule). The UI, switches and database are real; replace each layer using the guide.
        </p>

        <section className="grid gap-3 md:grid-cols-3">
          <LayerSwitch step={1} tech="OOA-PSO" title="Feature selection" on={cfg.featureSelection} onChange={(v) => set("featureSelection", v)}
            whenOn="Keeps only useful signals." whenOff="Uses all 5 signals, noise included." />
          <LayerSwitch step={2} tech="CNN-LSTM" title="Load prediction" on={cfg.predictor} onChange={(v) => set("predictor", v)}
            whenOn="Forecasts the next load value." whenOff="No forecast: scheduler assumes an average task." />
          <LayerSwitch step={3} tech="DQN" title="Task scheduling" on={cfg.scheduler} onChange={(v) => set("scheduler", v)}
            whenOn="Learned policy picks the VM." whenOff="Round Robin: tasks rotate over VMs." />
        </section>
        {hint && <p className="text-sm text-slate-500">{hint}</p>}

        <section className="flex flex-wrap items-end gap-4">
          {(["numTasks", "numVMs", "seed"] as const).map((k) => (
            <label key={k} className="text-sm">
              <span className="mb-1 block text-slate-500">{k === "numTasks" ? "Tasks" : k === "numVMs" ? "VMs" : "Seed"}</span>
              <input type="number" className={inp} value={cfg[k]} onChange={(e) => set(k, Number(e.target.value))} />
            </label>
          ))}
          <button onClick={run} disabled={busy} className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:opacity-50">Run this combination</button>
          <button onClick={runAll} disabled={busy} className="rounded-lg border border-blue-600 px-4 py-2 font-medium text-blue-600 disabled:opacity-50 dark:border-blue-400 dark:text-blue-400">Compare all 8</button>
        </section>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}

        {result && (
          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="font-semibold">{comboLabel(result.config)} · scheduler: {result.schedulerName}</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Kpi label="Makespan (s)" value={result.metrics.makespan.toFixed(2)} />
              <Kpi label="Throughput (tasks/s)" value={result.metrics.throughput.toFixed(2)} />
              <Kpi label="Utilisation SD" value={result.metrics.utilizationSD.toFixed(3)} />
              <Kpi label="Energy (kJ)" value={result.metrics.energyKJ.toFixed(1)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {FEATURES.map((f) => (
                <span key={f} className={`rounded-full border px-3 py-1 text-sm ${result.selectedFeatures.includes(f) ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 text-slate-400 line-through dark:border-slate-600"}`}>{f}</span>
              ))}
            </div>
            {result.predictor ? (
              <div>
                <p className="mb-1 text-sm text-slate-500">
                  Forecast vs actual (<span className="text-blue-600">actual</span>, <span className="text-orange-600">predicted</span>) · MSE {result.predictor.mse.toFixed(5)} · MAE {result.predictor.mae.toFixed(4)} · R² {result.predictor.r2.toFixed(3)}
                </p>
                <LineChart a={result.series.actual} b={result.series.predicted} />
              </div>
            ) : <p className="text-sm text-slate-500">Layer 2 is off, so there is no forecast.</p>}
            <div className="space-y-1">
              <p className="text-sm text-slate-500">Busy time per VM (a flatter picture means better balance)</p>
              {result.vmBusy.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-12 text-slate-500">VM {i + 1}</span>
                  <div className="h-3 rounded bg-blue-500" style={{ width: `${(b / result.metrics.makespan) * 100}%` }} />
                </div>
              ))}
            </div>
          </section>
        )}

        {compare.length > 0 && (
          <section className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-2 font-semibold">All 8 combinations (same data, same seed)</h2>
            <table className="w-full text-left text-sm">
              <thead className="text-slate-500"><tr>
                <th className="py-1 pr-3">Combination</th><th className="pr-3">Features</th><th className="pr-3">Makespan</th><th className="pr-3">vs baseline</th><th className="pr-3">Util. SD</th><th className="pr-3">Energy</th><th>R²</th>
              </tr></thead>
              <tbody>
                {compare.map((r, i) => (
                  <tr key={i} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-1 pr-3 font-medium">{comboLabel(r.config)}</td>
                    <td className="pr-3">{r.selectedFeatures.length}/5</td>
                    <td className={`pr-3 tabular-nums ${r.metrics.makespan === bestMk ? "font-semibold text-emerald-600" : ""}`}>{r.metrics.makespan.toFixed(2)}</td>
                    <td className="pr-3 tabular-nums">{baseline ? `${((1 - r.metrics.makespan / baseline.metrics.makespan) * 100).toFixed(1)}%` : "-"}</td>
                    <td className="pr-3 tabular-nums">{r.metrics.utilizationSD.toFixed(3)}</td>
                    <td className="pr-3 tabular-nums">{r.metrics.energyKJ.toFixed(1)}</td>
                    <td className="tabular-nums">{r.predictor ? r.predictor.r2.toFixed(3) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <section>
          <h2 className="mb-2 font-semibold">Saved runs</h2>
          {history.length === 0 ? <p className="text-sm text-slate-500">Nothing saved yet.</p> : (
            <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
              {history.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                  <button className="text-left hover:underline" onClick={() => { setResult(h.result); setCfg(h.result.config); }}>
                    {h.label} · makespan {h.result.metrics.makespan.toFixed(2)} · {new Date(h.created_at).toLocaleString()}
                  </button>
                  <button className="text-red-600" onClick={() => remove(h.id)} aria-label="Delete run">Delete</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
