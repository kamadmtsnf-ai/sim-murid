import type { ComponentProps } from "react";
import {
  CircleAlert,
  Info,
  CheckCircle2,
  TriangleAlert,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
const tones = {
  info: { icon: Info, style: "border-info/30 bg-info-subtle text-info" },
  success: {
    icon: CheckCircle2,
    style: "border-success/30 bg-success-subtle text-success",
  },
  error: {
    icon: CircleAlert,
    style: "border-destructive/30 bg-danger-subtle text-destructive",
  },
  warning: {
    icon: TriangleAlert,
    style: "border-warning/30 bg-warning-subtle text-warning",
  },
  pending: {
    icon: LoaderCircle,
    style: "border-info/30 bg-info-subtle text-info",
  },
};
/** Additive API: existing info/success/error callers retain their live-region semantics. */
export function Status({
  children,
  tone = "info",
  className,
  ...props
}: Omit<ComponentProps<"div">, "role"> & { tone?: keyof typeof tones }) {
  const { icon: Icon, style } = tones[tone];
  return (
    <div
      {...props}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={cn(
        "ds-status flex min-w-0 items-start gap-3 rounded-lg border p-4 text-sm",
        style,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</div>
    </div>
  );
}
