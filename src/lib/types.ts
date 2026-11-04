export const FEATURES = ["CPU", "Memory", "Bandwidth", "Latency", "Disk I/O"] as const;

export interface PipelineConfig {
  featureSelection: boolean; // Layer 1: OOA-PSO
  predictor: boolean; // Layer 2: CNN-LSTM
  scheduler: boolean; // Layer 3: DQN
  seed: number;
  numTasks: number;
  numVMs: number;
}

export type LayerFlags = Pick<PipelineConfig, "featureSelection" | "predictor" | "scheduler">;

export interface PredictorMetrics {
  mse: number;
  mae: number;
  r2: number;
}

export interface Metrics {
  makespan: number; // seconds, lower is better
  throughput: number; // tasks per second
  utilizationSD: number; // spread of VM utilisation, lower is better
  energyKJ: number; // lower is better
}

/** This shape is the contract between the UI and any layer backend (placeholder or Python). */
export interface RunResult {
  config: PipelineConfig;
  selectedFeatures: string[];
  predictor: PredictorMetrics | null;
  schedulerName: string;
  metrics: Metrics;
  series: { actual: number[]; predicted: number[] | null };
  vmBusy: number[];
}

export interface HistoryRow {
  id: string;
  created_at: string;
  label: string;
  result: RunResult;
}

export function comboLabel(c: LayerFlags): string {
  const parts = [c.featureSelection && "OOA-PSO", c.predictor && "CNN-LSTM", c.scheduler && "DQN"].filter(Boolean);
  return parts.length ? parts.join(" + ") : "Baseline (no layers)";
}
