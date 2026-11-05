import {
  cloneElement,
  isValidElement,
  type ReactNode,
  type InputHTMLAttributes,
} from "react";
import { CircleAlert } from "lucide-react";
import { FloatingLabel } from "./floating-label";
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
  const floating =
    isValidElement<InputHTMLAttributes<HTMLInputElement>>(children) &&
    (children.type === "textarea" ||
      (children.type === "input" &&
        !["checkbox", "radio", "file", "hidden", "range", "color"].includes(
          children.props.type ?? "text",
        )));
  const control = isValidElement<InputHTMLAttributes<HTMLInputElement>>(children) &&
    typeof children.type === "string" &&
    ["input", "select", "textarea"].includes(children.type)
    ? cloneElement(children, {
        "aria-invalid": error ? true : children.props["aria-invalid"],
        "aria-describedby": [...new Set([
          children.props["aria-describedby"],
          fieldDescriptionIds(id, description, error),
        ].filter(Boolean).join(" ").split(/\s+/).filter(Boolean))].join(" ") || undefined,
        ...(floating ? { placeholder: children.props.placeholder ?? " " } : {}),
      })
    : children;
  const caption = (
    <>
      {label}
      {required && (
        <span aria-hidden="true" className="ml-1 text-destructive">
          *
        </span>
      )}
    </>
  );
  return (
    <div className={cn("ds-field", className)}>
      {floating ? (
        <FloatingLabel htmlFor={id} label={caption}>
          {control}
        </FloatingLabel>
      ) : (
        <>
          <label htmlFor={id} className="ds-field-label">
            {caption}
          </label>
          {control}
        </>
      )}
      {description && (
        <p id={`${id}-help`} className="ds-field-help">
          {description}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="ds-field-error flex items-start gap-2">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 [overflow-wrap:anywhere]">{error}</span>
        </p>
      )}
    </div>
  );
}
