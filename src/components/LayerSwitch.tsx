interface Props {
  step: number;
  tech: string;
  title: string;
  on: boolean;
  onChange: (v: boolean) => void;
  whenOn: string;
  whenOff: string;
}

export default function LayerSwitch({ step, tech, title, on, onChange, whenOn, whenOff }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        on
          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40"
          : "border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-900"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-500">
          Layer {step} · {tech}
        </span>
        <span className={`relative h-6 w-11 rounded-full transition ${on ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </span>
      </div>
      <h3 className="mt-2 font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{on ? whenOn : whenOff}</p>
    </button>
  );
}
