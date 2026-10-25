import type { ComponentProps, ReactNode } from "react";
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
  heading,
  hint,
  ...props
}: Omit<ComponentProps<"div">, "role"> & {
  tone?: keyof typeof tones;
  heading?: ReactNode;
  hint?: ReactNode;
}) {
  const { icon: Icon, style } = tones[tone];
  const label =
    heading ??
    (
      {
        info: "Informasi",
        success: "Berhasil",
        error: "Perlu perhatian",
        warning: "Perlu diperiksa",
        pending: "Sedang diproses",
      } as const
    )[tone];
  return (
    <div
      {...props}
      role={tone === "error" ? "alert" : "status"}
      aria-atomic="true"
      className={cn(
        "ds-status flex min-w-0 items-start gap-3 rounded-xl border p-4 text-sm leading-relaxed",
        style,
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-5 shrink-0",
          tone === "pending" && "motion-safe:animate-spin",
        )}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
        {label && <p className="mb-1 font-semibold">{label}</p>}
        <div>{children}</div>
        {hint && (
          <p className="mt-2 border-t border-current/15 pt-2 text-sm">{hint}</p>
        )}
      </div>
    </div>
  );
}
