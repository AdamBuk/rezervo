"use client";

import { useFormStatus } from "react-dom";

type Props = React.ComponentProps<"button"> & { pendingText?: string };

/** Submit button that disables itself while the parent form's action is running. */
export function SubmitButton({ children, pendingText, className = "btn-primary", disabled, ...rest }: Props) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} aria-busy={pending} className={className} {...rest}>
      {pending ? (pendingText ?? "Ukládám…") : children}
    </button>
  );
}
