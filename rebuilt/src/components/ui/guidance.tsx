import type { ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";

/** Optional explanations only. Keep errors, required input rules and consequences visible. */
export function Guidance({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="collapse ui-guidance group/guidance">
      <summary className="collapse-title">
        <Info aria-hidden="true" className="size-[16px] shrink-0 text-primary" />
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown aria-hidden="true" className="size-[16px] shrink-0 transition-transform group-open/guidance:rotate-180 motion-reduce:transition-none" />
      </summary>
      <div className="collapse-content ui-guidance-body">{children}</div>
    </details>
  );
}
