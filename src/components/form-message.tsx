import type { ActionState } from "@/lib/constants";

export function FormMessage({ state }: { state: ActionState }) {
  if (state?.error) {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
        {state.error}
      </p>
    );
  }
  if (state?.success) {
    return (
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">
        {state.success}
      </p>
    );
  }
  return null;
}
