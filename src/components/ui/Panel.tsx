import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
  id?: string;
  index: string;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function Panel({
  id,
  index,
  title,
  subtitle,
  right,
  children,
  className,
  bodyClassName,
}: PanelProps) {
  return (
    <section
      id={id}
      className={cn("panel flex min-w-0 flex-col", className)}
      aria-label={`${index}. ${title}`}
    >
      <header className="panel-head">
        <div className="min-w-0">
          <h2 className="truncate font-sans text-[10px] font-medium uppercase tracking-[0.2em] text-lab-muted">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 max-w-[56ch] font-serif text-[13.5px] italic leading-snug text-lab-faint">
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
