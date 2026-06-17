type Point = { key: string; label: string } & Record<string, string | number | null>;

export function AIValueTrendChart({
  title,
  points,
  series,
  percent = false,
}: {
  title: string;
  points: Point[];
  series: Array<{ key: string; label: string; color: string }>;
  percent?: boolean;
}) {
  const width = 720;
  const height = 220;
  const padding = 28;
  const values = points.flatMap((point) => series.map((item) => Number(point[item.key] ?? 0)));
  const max = percent ? 1 : Math.max(...values, 1);
  const coordinate = (value: number, index: number) => ({
    x: padding + (index * (width - padding * 2)) / Math.max(points.length - 1, 1),
    y: height - padding - (value / max) * (height - padding * 2),
  });

  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
        {series.map((item) => <span key={item.key} className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />{item.label}</span>)}
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[640px]" role="img" aria-label={title}>
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#cbd5e1" />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#cbd5e1" />
          {series.map((item) => {
            const coordinates = points.map((point, index) => ({ ...coordinate(Number(point[item.key] ?? 0), index), point }));
            return <polyline key={item.key} fill="none" stroke={item.color} strokeWidth="3" points={coordinates.map(({ x, y }) => `${x},${y}`).join(" ")} />;
          })}
          {points.map((point, index) => {
            const { x } = coordinate(0, index);
            return index === 0 || index === points.length - 1 || index % Math.max(1, Math.floor(points.length / 6)) === 0
              ? <text key={point.key} x={x} y={height - 8} textAnchor="middle" fontSize="10" fill="#64748b">{point.label}</text>
              : null;
          })}
        </svg>
      </div>
    </section>
  );
}
