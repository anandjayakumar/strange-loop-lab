import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
  index: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  index,
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section className={cn("panel flex min-w-0 flex-col", className)}>
      <header className="panel-head">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-[10px] tracking-[0.1em] text-lab-amber/80">
              {index}
            </span>
            <h2 className="truncate text-[13px] font-medium tracking-[-0.01em] text-lab-text">
              {title}
            </h2>
          </div>
          {subtitle ? (
            <p className="mt-0.5 max-w-[52ch] truncate font-mono text-[9px] text-lab-faint">
              {subtitle}
            </p>
          ) : null}
        </div>
        {right ? <div className="shrink-0">{right}</div> : null}
      </header>
      <div className={cn("min-h-0 flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  );
}
