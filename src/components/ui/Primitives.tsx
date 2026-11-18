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
        "group flex min-w-0 items-center gap-2 rounded-full px-2 py-1 text-left transition-colors",
        disabled ? "cursor-not-allowed opacity-40" : "hover:bg-lab-raise",
      )}
      title={hint}
    >
      <span
        className={cn(
          "relative h-[13px] w-[24px] shrink-0 rounded-full border transition-colors",
          checked ? "border-lab-text bg-lab-text" : "border-lab-line2 bg-transparent",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] h-[7px] w-[7px] rounded-full transition-all",
            checked ? "left-[13px] bg-lab-bg" : "left-[2px] bg-lab-line2",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate font-sans text-[9px] font-medium uppercase tracking-[0.1em] text-lab-muted group-hover:text-lab-text">
          {label}
        </span>
        {hint ? (
          <span className="block truncate font-serif text-[10.5px] italic leading-tight text-lab-faint">
            {hint}
          </span>
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
        <span className="num text-[10.5px] text-lab-text">{value}</span>
      </div>
      <div className="mt-1.5 h-[3px] overflow-hidden bg-lab-raise">
        <div
          className="h-full transition-[width] duration-300"
          style={{ width: `${clamp01(ratio) * 100}%`, background: color }}
        />
      </div>
      {compare ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="font-serif text-[10px] italic text-lab-faint">{hint ?? "reference"}</span>
          <span className="num text-[8.5px] text-lab-faint">{compare.value}</span>
        </div>
      ) : hint ? (
        <div className="mt-1 font-serif text-[10px] italic text-lab-faint">{hint}</div>
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
        <circle cx="38" cy="38" r={r} fill="none" stroke="#ded4c1" strokeWidth="2.5" />
        <circle
          cx="38"
          cy="38"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
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
          fill="#17130d"
          fontSize="14"
          fontFamily="Instrument Serif, Georgia, serif"
        >
          {(value * 100).toFixed(0)}
        </text>
        <text
          x="38"
          y="52"
          textAnchor="middle"
          fill="#6f6657"
          fontSize="6"
          fontFamily="DM Sans, sans-serif"
          letterSpacing="1"
        >
          /100
        </text>
      </svg>
      <div className="text-center">
        <div className="font-sans text-[8.5px] font-medium uppercase tracking-[0.14em] text-lab-muted">
          {label}
        </div>
        {caption ? (
          <div className="font-serif text-[10.5px] italic leading-tight text-lab-faint">{caption}</div>
        ) : null}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  color = "#17130d",
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
    <div className={cn("min-w-0 border-t border-lab-line pt-2", className)}>
      <div className="mono-label truncate">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <span className="num text-[19px] leading-none" style={{ color }}>
          {value}
        </span>
        {spark ? <span className="shrink-0 opacity-90">{spark}</span> : null}
      </div>
      {sub ? (
        <div className="mt-1.5 truncate font-serif text-[10.5px] italic text-lab-faint">{sub}</div>
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
        <span className="num text-[9.5px] text-lab-muted">
          {right ?? `${(value * 100).toFixed(0)}%`}
        </span>
      </div>
      <div className="mt-1 h-[3px] overflow-hidden bg-lab-raise">
        <div
          className="h-full"
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
