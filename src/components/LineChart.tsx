export default function LineChart({ a, b }: { a: number[]; b: number[] | null }) {
  const all = [...a, ...(b ?? [])];
  const mn = Math.min(...all), mx = Math.max(...all);
  const pts = (s: number[]) =>
    s.map((v, i) => `${(i / (s.length - 1)) * 100},${38 - ((v - mn) / (mx - mn || 1)) * 36}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-40 w-full rounded-lg border border-slate-200 dark:border-slate-700">
      <polyline fill="none" stroke="#2563eb" strokeWidth={2} vectorEffect="non-scaling-stroke" points={pts(a)} />
      {b && <polyline fill="none" stroke="#ea580c" strokeWidth={2} vectorEffect="non-scaling-stroke" points={pts(b)} />}
    </svg>
  );
}
