import { useEffect, useId, useRef, useState } from "react";
import { cn } from "../../lib/cn";
import { downsample } from "../../ui/format";

export interface PlotSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  dashed?: boolean;
  fill?: boolean;
  width?: number;
}

interface PlotProps {
  series: PlotSeries[];
  height?: number;
  min?: number;
  max?: number;
  formatValue?: (value: number) => string;
  tickCount?: number;
  emptyLabel?: string;
  ariaLabel: string;
  showLegend?: boolean;
  className?: string;
  legendNote?: string;
}

const DEFAULT_WIDTH = 360;
const LEFT = 34;
const RIGHT = 6;
const TOP = 8;
const BOTTOM = 15;

export function Plot({
  series,
  height = 124,
  min,
  max,
  formatValue = (v) => v.toFixed(1),
  tickCount = 4,
  emptyLabel = "Awaiting samples",
  ariaLabel,
  showLegend = true,
  className,
  legendNote,
}: PlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width ?? DEFAULT_WIDTH;
      if (measured > 0) setWidth(Math.max(160, measured));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const sampled = series.map((s) => ({
    ...s,
    sampled: downsample(s.values, 140),
  }));
  const all = sampled.flatMap((s) => s.sampled).filter((v): v is number => v !== null);
  const hasData = all.length > 0;

  let domainMin = min ?? (hasData ? Math.min(...all) : 0);
  let domainMax = max ?? (hasData ? Math.max(...all) : 1);
  if (domainMin === domainMax) {
    domainMin -= 0.5;
    domainMax += 0.5;
  }
  if (min === undefined && max === undefined) {
    const pad = (domainMax - domainMin) * 0.08;
    domainMin -= pad;
    domainMax += pad;
  }

  const innerW = width - LEFT - RIGHT;
  const innerH = height - TOP - BOTTOM;
  const yFor = (v: number) =>
    TOP + (1 - (v - domainMin) / (domainMax - domainMin)) * innerH;

  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const t = i / tickCount;
    return domainMax - (domainMax - domainMin) * t;
  });

  return (
    <div ref={containerRef} className={cn("min-w-0", className)}>
      {showLegend ? (
        <div className="mb-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {series.map((s) => {
            const last = [...s.values].reverse().find((v) => v !== null);
            return (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span
                  className="h-[2px] w-3 rounded-full"
                  style={{ background: s.color, opacity: s.dashed ? 0.55 : 1 }}
                />
                <span className="font-mono text-[9px] text-lab-faint">{s.label}</span>
                <span className="font-mono text-[9px] tabular-nums text-lab-muted">
                  {last === null || last === undefined ? "—" : formatValue(last)}
                </span>
              </span>
            );
          })}
          {legendNote ? (
            <span className="ml-auto font-mono text-[8px] uppercase tracking-[0.1em] text-lab-faint">
              {legendNote}
            </span>
          ) : null}
        </div>
      ) : null}
      {hasData ? (
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          className="block w-full overflow-visible"
          style={{ height }}
        >
          <defs>
            {sampled.map((s) =>
              s.fill ? (
                <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity="0.16" />
                  <stop offset="100%" stopColor={s.color} stopOpacity="0" />
                </linearGradient>
              ) : null,
            )}
          </defs>
          {ticks.map((value, i) => {
            const y = yFor(value);
            return (
              <g key={i}>
                <line
                  x1={LEFT}
                  x2={width - RIGHT}
                  y1={y}
                  y2={y}
                  stroke="#e6ddcd"
                  strokeWidth="0.7"
                />
                <text
                  x={LEFT - 5}
                  y={y + 2.6}
                  textAnchor="end"
                  fill="#6f6657"
                  fontSize="7.5"
                  fontFamily="JetBrains Mono, monospace"
                >
                  {formatValue(value)}
                </text>
              </g>
            );
          })}
          {sampled.map((s) => {
            const n = s.sampled.length;
            if (n === 0) return null;
            const xFor = (i: number) =>
              n === 1 ? LEFT + innerW / 2 : LEFT + (i / (n - 1)) * innerW;
            const segments: string[] = [];
            let current: string[] = [];
            s.sampled.forEach((value, i) => {
              if (value === null) {
                if (current.length > 1) segments.push(current.join(" "));
                current = [];
                return;
              }
              current.push(`${current.length === 0 ? "M" : "L"}${xFor(i).toFixed(2)},${yFor(value).toFixed(2)}`);
            });
            if (current.length > 1) segments.push(current.join(" "));
            const path = segments.join(" ");
            const fillPath =
              s.fill && n > 1
                ? (() => {
                    const points: string[] = [];
                    s.sampled.forEach((value, i) => {
                      if (value !== null) {
                        points.push(`${xFor(i).toFixed(2)},${yFor(value).toFixed(2)}`);
                      }
                    });
                    if (points.length < 2) return null;
                    return `M${points[0]} ${points.slice(1).map((p) => `L${p}`).join(" ")} L${xFor(n - 1).toFixed(2)},${(TOP + innerH).toFixed(2)} L${xFor(0).toFixed(2)},${(TOP + innerH).toFixed(2)} Z`;
                  })()
                : null;
            return (
              <g key={s.key}>
                {fillPath ? (
                  <path d={fillPath} fill={`url(#${uid}-${s.key})`} stroke="none" />
                ) : null}
                <path
                  d={path}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.width ?? 1.35}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dashed ? "3 3" : undefined}
                  opacity={s.dashed ? 0.65 : 1}
                />
                {(() => {
                  const lastIndex = s.sampled.reduce<number>(
                    (acc, value, i) => (value !== null ? i : acc),
                    -1,
                  );
                  if (lastIndex < 0) return null;
                  const last = s.sampled[lastIndex] as number;
                  return (
                    <circle
                      cx={xFor(lastIndex)}
                      cy={yFor(last)}
                      r="1.8"
                      fill={s.color}
                      stroke="#faf7ef"
                      strokeWidth="0.8"
                    />
                  );
                })()}
              </g>
            );
          })}
          <text
            x={LEFT}
            y={height - 3}
            fill="#a89e8d"
            fontSize="7"
            fontFamily="JetBrains Mono, monospace"
          >
            PAST
          </text>
          <text
            x={width - RIGHT}
            y={height - 3}
            textAnchor="end"
            fill="#a89e8d"
            fontSize="7"
            fontFamily="JetBrains Mono, monospace"
          >
            NOW
          </text>
        </svg>
      ) : (
        <div
          className="flex items-center justify-center rounded border border-dashed border-lab-line/70 font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint"
          style={{ height }}
        >
          {emptyLabel}
        </div>
      )}
    </div>
  );
}

export function Sparkline({
  values,
  color,
  width = 76,
  height = 22,
  min,
  max,
}: {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
  min?: number;
  max?: number;
}) {
  const sampled = downsample(values, 50);
  const nums = sampled.filter((v): v is number => v !== null);
  if (nums.length < 2) {
    return <div style={{ width, height }} className="rounded bg-lab-raise/40" />;
  }
  const lo = min ?? Math.min(...nums);
  const hi = max ?? Math.max(...nums);
  const span = hi - lo || 1;
  const x = (i: number) => (i / (sampled.length - 1)) * width;
  const y = (v: number) => height - 2 - ((v - lo) / span) * (height - 4);
  let path = "";
  sampled.forEach((v, i) => {
    if (v === null) return;
    path += `${path ? " L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  return (
    <svg width={width} height={height} aria-hidden="true" className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.1" opacity="0.8" />
    </svg>
  );
}
