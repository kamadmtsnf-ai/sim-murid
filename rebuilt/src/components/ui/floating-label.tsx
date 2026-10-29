import type { LabelHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Native labels and CSS state keep reset, autofill and uncontrolled forms intact. */
export function FloatingLabel({
  label,
  children,
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label {...props} className={cn("floating-label-field", className)}>
      <span className="floating-label-text">{label}</span>
      {children}
    </label>
  );
}
