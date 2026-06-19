type TrendPoint = { key: string; label: string; costEur: number; calls: number };

export function AICostTrendChart({ title, points }: { title: string; points: TrendPoint[] }) {
  const width = 720;
  const height = 220;
  const padding = 28;
  const max = Math.max(...points.map((point) => point.costEur), 0.000001);
  const coordinates = points.map((point, index) => {
    const x = padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1);
    const y = height - padding - (point.costEur / max) * (height - padding * 2);
    return { ...point, x, y };
  });
  const polyline = coordinates.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        <span className="text-xs text-slate-500">Coût estimé EUR</span>
      </div>
      <div className="mt-4 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px]" role="img" aria-label={title}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />
          <polyline fill="none" stroke="#6d28d9" strokeWidth="3" points={polyline} />
          {coordinates.map((point, index) => (
            <g key={point.key}>
              <circle cx={point.x} cy={point.y} r="4" fill="#6d28d9"><title>{`${point.key}: ${point.costEur.toFixed(6)} EUR, ${point.calls} appel(s)`}</title></circle>
              {(index === 0 || index === coordinates.length - 1 || index % Math.max(1, Math.floor(points.length / 6)) === 0) ? (
                <text x={point.x} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text>
              ) : null}
            </g>
          ))}
        </svg>
      </div>
    </section>
  );
}
