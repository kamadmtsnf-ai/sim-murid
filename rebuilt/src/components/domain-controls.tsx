"use client";
import { useId, type ReactNode } from "react";
import { Field, fieldControlClass } from "./ui/field";
/** Compatibility adapter: names/default values/native validation remain with each domain. */
export const controlClass = fieldControlClass;
export function TextField({
  label,
  name,
  value = "",
  type = "text",
  required = false,
  max = 200,
}: {
  label: string;
  name: string;
  value?: string | undefined;
  type?: string;
  required?: boolean;
  max?: number;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} required={required}>
      <input
        id={id}
        name={name}
        type={type}
        className={controlClass}
        defaultValue={value}
        required={required}
        maxLength={max}
      />
    </Field>
  );
}
export function SelectField({
  label,
  name,
  value = "",
  children,
  required = false,
}: {
  label: string;
  name: string;
  value?: string | undefined;
  children: ReactNode;
  required?: boolean;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} required={required}>
      <select
        id={id}
        name={name}
        defaultValue={value}
        className={controlClass}
        required={required}
      >
        {children}
      </select>
    </Field>
  );
}
