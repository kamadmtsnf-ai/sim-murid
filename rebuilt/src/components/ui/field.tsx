import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Shared presentation only: callers retain values, validation and submission. */
export const fieldControlClass = "ds-field-control";

export function fieldDescriptionIds(
  id: string,
  description?: ReactNode,
  error?: string,
) {
  return (
    [description ? `${id}-help` : "", error ? `${id}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  );
}

export function Field({
  id,
  label,
  description,
  error,
  required = false,
  children,
  className,
}: {
  id: string;
  label: string;
  description?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ds-field", className)}>
      <label htmlFor={id} className="ds-field-label">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-1 text-destructive">
            *
          </span>
        )}
      </label>
      {children}
      {description && (
        <p id={`${id}-help`} className="ds-field-help">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="ds-field-error">
          {error}
        </p>
      )}
    </div>
  );
}
