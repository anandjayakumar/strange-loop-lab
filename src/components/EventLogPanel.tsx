import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import type { EventKind, SimEvent } from "../simulation/types";
import { cn } from "../lib/cn";
import { TICK_LABEL } from "../ui/format";
import { Panel } from "./ui/Panel";

const KIND_COLOR: Record<EventKind, string> = {
  env: "#5cdb95",
  risk: "#ff6f6f",
  model: "#5fd0e3",
  meta: "#b49cff",
  action: "#f0a35e",
  system: "#8b929b",
};

const FILTERS: { key: EventKind | "all"; label: string }[] = [
  { key: "all", label: "all" },
  { key: "model", label: "self" },
  { key: "meta", label: "meta" },
  { key: "risk", label: "risk" },
  { key: "env", label: "world" },
  { key: "action", label: "action" },
  { key: "system", label: "system" },
];

export function EventLogPanel({ events }: { events: readonly SimEvent[] }) {
  const [filter, setFilter] = useState<EventKind | "all">("all");
  const visible = useMemo(() => {
    const filtered = filter === "all" ? events : events.filter((event) => event.kind === filter);
    return [...filtered].reverse().slice(0, 220);
  }, [events, filter]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const event of events) map.set(event.kind, (map.get(event.kind) ?? 0) + 1);
    return map;
  }, [events]);

  return (
    <Panel
      index="06"
      title="Event log"
      subtitle="State changes and threshold crossings only"
      right={
        <span className="chip">
          <ScrollText size={10} />
          {events.length}
        </span>
      }
      bodyClassName="p-0"
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-lab-line/60 px-3 py-2">
        {FILTERS.map((item) => {
          const active = filter === item.key;
          const count =
            item.key === "all" ? events.length : (counts.get(item.key) ?? 0);
          return (
            <button
              key={item.key}
              onClick={() => setFilter(item.key)}
              className={cn(
                "rounded px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] transition-colors",
                active
                  ? "bg-lab-raise text-lab-text"
                  : "text-lab-faint hover:bg-lab-raise/60 hover:text-lab-muted",
              )}
              aria-pressed={active}
            >
              {item.label}
              <span className="ml-1 tabular-nums text-lab-faint/70">{count}</span>
            </button>
          );
        })}
        <span className="ml-auto font-mono text-[8px] text-lab-faint">newest first</span>
      </div>

      <div className="max-h-[320px] min-h-[190px] overflow-y-auto px-3 scroll-thin">
        {visible.length === 0 ? (
          <div className="grid h-[190px] place-items-center font-mono text-[9px] uppercase tracking-[0.12em] text-lab-faint">
            no events for this filter
          </div>
        ) : (
          <ul className="divide-y divide-lab-line/40">
            {visible.map((event) => (
              <li key={event.id} className="flex gap-2.5 py-1.5">
                <span className="shrink-0 pt-[1px] font-mono text-[8px] tabular-nums text-lab-faint">
                  {TICK_LABEL(event.tick)}
                </span>
                <span
                  className="mt-[4px] h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: KIND_COLOR[event.kind], opacity: 0.9 }}
                />
                <p className="min-w-0 text-[10.5px] leading-snug text-lab-muted">{event.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-lab-line/60 px-3 py-1.5">
        <p className="font-mono text-[7.5px] leading-relaxed text-lab-faint">
          Log statements are templated from measured values. No event is written unless a
          corresponding state change or threshold crossing occurred.
        </p>
      </div>
    </Panel>
  );
}
