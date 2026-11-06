import type { AnyFieldApi } from "@tanstack/react-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A labelled input bound to a TanStack Form field, with its first error in French. */
export function FormField({
  field,
  label,
  type = "text",
  autoComplete,
  placeholder,
}: {
  field: AnyFieldApi;
  label: string;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  const error = field.state.meta.isTouched ? field.state.meta.errors[0] : undefined;
  const message =
    typeof error === "string" ? error : (error as { message?: string } | undefined)?.message;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={Boolean(message)}
      />
      {message ? <p className="text-xs text-destructive">{message}</p> : null}
    </div>
  );
}
