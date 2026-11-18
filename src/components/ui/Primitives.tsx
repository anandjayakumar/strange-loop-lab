import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { clamp01 } from "../../ui/format";
import { Sparkline } from "./Plot";

export function Toggle({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "group flex min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-lab-raise/70",
      )}
      title={hint}
    >
      <span
        className={cn(
          "relative h-[14px] w-[26px] shrink-0 rounded-full border transition-colors",
          checked
            ? "border-lab-amber/50 bg-lab-amber/30"
            : "border-lab-line2 bg-lab-bg",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[8px] w-[8px] rounded-full transition-all",
            checked
              ? "left-[14px] bg-lab-amber shadow-[0_0_6px_rgba(240,163,94,0.7)]"
              : "left-[2px] bg-lab-faint",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-mono text-[9px] uppercase tracking-[0.08em] text-lab-muted group-hover:text-lab-text">
          {label}
        </span>
        {hint ? (
          <span className="block truncate font-mono text-[8px] text-lab-faint/80">{hint}</span>
        ) : null}
      </span>
    </button>
  );
}

export function Meter({
  label,
  value,
  ratio,
  color,
  hint,
  compare,
}: {
  label: string;
  value: string;
  ratio: number;
  color: string;
  hint?: string;
  compare?: { value: string; ratio: number; color: string };
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="mono-label truncate">{label}</span>
        <span className="font-mono text-[10px] tabular-nums text-lab-text">{value}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-lab-raise">
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${clamp01(ratio) * 100}%`,
            background: color,
            boxShadow: `0 0 8px ${color}55`,
          }}
        />
      </div>
      {compare ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-mono text-[8px] text-lab-faint">{hint ?? "reference"}</span>
          <span className="font-mono text-[8px] tabular-nums text-lab-faint">
            {compare.value}
          </span>
        </div>
      ) : hint ? (
        <div className="mt-1 font-mono text-[8px] text-lab-faint">{hint}</div>
      ) : null}
    </div>
  );
}

export function Ring({
  value,
  label,
  color,
  size = 84,
  caption,
}: {
  value: number;
  label: string;
  color: string;
  size?: number;
  caption?: string;
}) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamp01(value));
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width={size} height={size} viewBox="0 0 76 76" aria-label={`${label}: ${(value * 100).toFixed(0)}%`}>
        <circle cx="38" cy="38" r={r} fill="none" stroke="#1e2227" strokeWidth="4" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 38 38)"
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
        <text
          x="38"
          y="41"
          textAnchor="middle"
          fill="#e7e9eb"
          fontSize="13"
          fontFamily="JetBrains Mono, monospace"
        >
          {(value * 100).toFixed(0)}
        </text>
        <text
          x="38"
          y="51"
          textAnchor="middle"
          fill="#5b626b"
          fontSize="6"
          fontFamily="JetBrains Mono, monospace"
        >
          /100
        </text>
      </svg>
      <div className="text-center">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-lab-muted">
          {label}
        </div>
        {caption ? (
          <div className="font-mono text-[8px] text-lab-faint">{caption}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  color = "#e7e9eb",
  spark,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  spark?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-lab-line/70 bg-lab-raise/40 px-3 py-2.5",
        className,
      )}
    >
      <div className="mono-label truncate">{label}</div>
      <div className="mt-0.5 flex items-end justify-between gap-2">
        <span className="font-mono text-[17px] leading-tight tabular-nums" style={{ color }}>
          {value}
        </span>
        {spark ? <span className="shrink-0 opacity-80">{spark}</span> : null}
      </div>
      {sub ? (
        <div className="mt-0.5 truncate font-mono text-[8px] tabular-nums text-lab-faint">
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export function ConfidenceBar({
  label,
  value,
  color,
  right,
}: {
  label: string;
  value: number;
  color: string;
  right?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="mono-label">{label}</span>
        <span className="font-mono text-[9px] text-lab-muted">{right ?? `${(value * 100).toFixed(0)}%`}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-lab-raise">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamp01(value) * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

export function Spark({
  values,
  color,
  min,
  max,
}: {
  values: (number | null)[];
  color: string;
  min?: number;
  max?: number;
}) {
  return <Sparkline values={values} color={color} min={min} max={max} />;
}
