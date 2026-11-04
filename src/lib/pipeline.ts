/**
 * PLACEHOLDER layers. Each one is a simple stand-in with the same inputs/outputs the real model
 * will have, so the UI and the switches work today. Replace them one at a time (see GUIDE.md).
 */
import { FEATURES, PipelineConfig, PredictorMetrics, RunResult } from "./types";

const MIPS = [1000, 1500, 2000, 3000, 4000];
const POWER = [60, 80, 110, 150, 200];
const clamp = (x: number) => Math.min(1, Math.max(0, x));
const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Dataset = { X: number[][]; y: number[] };

/** Synthetic cloud trace: CPU, Memory, Bandwidth drive the load; Latency and Disk I/O are noise. */
function makeDataset(rand: () => number, T = 400): Dataset {
  const g = () => (rand() + rand() + rand() + rand() - 2) / 0.577;
  let bw = 0.5;
  const X: number[][] = [];
  for (let t = 0; t <= T; t++) {
    const cpu = clamp(0.5 + Math.sin(t / 25) * 0.25 + (t % 120 > 90 ? 0.2 : 0) + 0.05 * g());
    const mem = clamp(0.5 * cpu + 0.25 + 0.05 * g());
    bw = clamp(bw + 0.04 * g());
    X.push([cpu, mem, bw, rand(), clamp(0.5 + 0.3 * g())]);
  }
  const y = Array.from({ length: T }, (_, t) => clamp(0.5 * X[t + 1][0] + 0.3 * X[t + 1][1] + 0.2 * X[t + 1][2]));
  return { X: X.slice(0, T), y };
}

function pearson(a: number[], b: number[]) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return n / Math.sqrt(da * db || 1);
}

/** LAYER 1 placeholder (real version: OOA-PSO). Returns indices of the kept features. */
export function selectFeatures(ds: Dataset, enabled: boolean): number[] {
  if (!enabled) return FEATURES.map((_, i) => i);
  const keep = FEATURES.map((_, j) => (Math.abs(pearson(ds.X.map((r) => r[j]), ds.y)) > 0.3 ? j : -1)).filter((j) => j >= 0);
  return keep.length ? keep : [0];
}

/** LAYER 2 placeholder (real version: CNN-LSTM). Returns a load forecast for every time step. */
export function predictLoad(ds: Dataset, idx: number[]): { pred: number[]; metrics: PredictorMetrics } {
  const n = ds.y.length, k = Math.floor(n * 0.8);
  const w = Array(idx.length + 1).fill(0);
  const feat = (t: number) => idx.map((j) => ds.X[t][j]);
  const out = (x: number[]) => w[0] + x.reduce((s, v, i) => s + v * w[i + 1], 0);
  for (let ep = 0; ep < 400; ep++) {
    const gr = Array(w.length).fill(0);
    for (let t = 0; t < k; t++) {
      const x = feat(t), e = out(x) - ds.y[t];
      gr[0] += e;
      x.forEach((v, i) => (gr[i + 1] += e * v));
    }
    w.forEach((_, i) => (w[i] -= (0.5 * gr[i]) / k));
  }
  const pred = ds.y.map((_, t) => clamp(out(feat(t))));
  const a = ds.y.slice(k), p = pred.slice(k);
  const mse = mean(a.map((v, i) => (v - p[i]) ** 2));
  const mae = mean(a.map((v, i) => Math.abs(v - p[i])));
  const mu = mean(a);
  const r2 = 1 - (mse * a.length) / a.reduce((s, v) => s + (v - mu) ** 2, 0);
  return { pred, metrics: { mse, mae, r2 } };
}

/** LAYER 3 placeholder (real version: DQN). Returns each VM's total busy time. */
export function schedule(trueLen: number[], estLen: number[], vms: number, smart: boolean): number[] {
  const f = Array(vms).fill(0);
  trueLen.forEach((len, i) => {
    let a = i % vms; // Round Robin
    if (smart) {
      let best = Infinity;
      for (let m = 0; m < vms; m++) {
        const c = f[m] + estLen[i] / MIPS[m % 5];
        if (c < best) { best = c; a = m; }
      }
    }
    f[a] += len / MIPS[a % 5];
  });
  return f;
}

export function runPipeline(cfg: PipelineConfig): RunResult {
  const ds = makeDataset(rng(cfg.seed));
  const idx = selectFeatures(ds, cfg.featureSelection);
  const fc = cfg.predictor ? predictLoad(ds, idx) : null;
  const trueLen = Array.from({ length: cfg.numTasks }, (_, i) => 800 + 6000 * ds.y[i % ds.y.length]);
  const avg = mean(trueLen);
  const estLen = trueLen.map((_, i) => (fc ? 800 + 6000 * fc.pred[i % ds.y.length] : avg));
  const f = schedule(trueLen, estLen, cfg.numVMs, cfg.scheduler);
  const mk = Math.max(...f);
  const u = f.map((x) => x / mk), mu = mean(u);
  const energy = f.reduce((s, b, m) => s + POWER[m % 5] * b + 0.4 * POWER[m % 5] * (mk - b), 0) / 1000;
  return {
    config: cfg,
    selectedFeatures: idx.map((i) => FEATURES[i]),
    predictor: fc?.metrics ?? null,
    schedulerName: cfg.scheduler ? "DQN (placeholder: earliest-finish)" : "Round Robin",
    metrics: {
      makespan: mk,
      throughput: cfg.numTasks / mk,
      utilizationSD: Math.sqrt(mean(u.map((v) => (v - mu) ** 2))),
      energyKJ: energy,
    },
    series: { actual: ds.y.slice(-80), predicted: fc ? fc.pred.slice(-80) : null },
    vmBusy: f,
  };
}
