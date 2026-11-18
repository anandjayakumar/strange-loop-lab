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
      <header className="panel-head" aria-label={`${index}. ${title}`}>
        <div className="min-w-0">
          <h2 className="truncate font-serif text-[16px] font-normal leading-tight tracking-[-0.015em] text-lab-text">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-[56ch] truncate text-[10px] leading-snug text-lab-faint">
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
