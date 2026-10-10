"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { formatInTimeZone } from "@/lib/time";
import { manageApiKey, type ApiKeyState } from "./actions";

type ActiveKey = { prefix: string; createdAt: string; lastUsedAt: string | null; timeZone: string };
type Confirming = "create" | "revoke" | null;

const DATE_FORMAT: Intl.DateTimeFormatOptions = { day: "numeric", month: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" };

function KeyValue({ value, onHide }: { value: string; onHide: () => void }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2500);
    return () => clearTimeout(timer);
  }, [copy]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopy("copied");
    } catch {
      // Clipboard API unavailable (e.g. insecure context): select the text for manual copying.
      inputRef.current?.select();
      setCopy("failed");
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="api-key-value" className="sr-only">
          API klíč
        </label>
        <input
          ref={inputRef}
          id="api-key-value"
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          // Read-only field inside the manager's form: Enter must not submit it.
          onKeyDown={(e) => {
            if (e.key === "Enter") e.preventDefault();
          }}
          className="input font-mono text-xs"
          spellCheck={false}
          autoComplete="off"
        />
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={handleCopy} className="btn-secondary">
            {copy === "copied" ? "Zkopírováno ✓" : "Kopírovat"}
          </button>
          <button type="button" onClick={onHide} className="btn-secondary">
            Skrýt
          </button>
        </div>
      </div>
      <p className="mt-1 min-h-5 text-xs text-stone-500" aria-live="polite">
        {copy === "failed" ? "Kopírování se nezdařilo – klíč je označený, zkopírujte ho pomocí Ctrl+C." : ""}
      </p>
    </div>
  );
}

export function ApiKeyManager({ activeKey }: { activeKey: ActiveKey | null }) {
  const [state, formAction] = useActionState<ApiKeyState, FormData>(manageApiKey, { status: "idle" });
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [hidden, setHidden] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // React to a finished action during render (not in an effect): close the confirmation, show the key again.
  const [handledState, setHandledState] = useState(state);
  if (handledState !== state) {
    setHandledState(state);
    setConfirming(null);
    setHidden(false);
  }

  useEffect(() => {
    if (!confirming) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirming(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirming]);

  const visibleKey = activeKey && !hidden && (state.status === "created" || state.status === "revealed") ? state.key : null;

  return (
    <form action={formAction} className="grid gap-4">
      {state.status === "error" && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state.status === "created" && activeKey && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">
          Nový klíč je vygenerovaný a předchozí přestal fungovat. Vložte ho do aplikace, která API používá.
        </p>
      )}
      {state.status === "revoked" && (
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800" role="status">
          Klíč byl zneplatněn. Aplikace, které ho používaly, už nemají přístup.
        </p>
      )}

      {activeKey ? (
        <div className="grid gap-3 rounded-xl border border-stone-200 p-4">
          {visibleKey ? (
            <KeyValue value={visibleKey} onHide={() => setHidden(true)} />
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-mono text-sm text-stone-600">
                {activeKey.prefix}
                <span aria-hidden="true">••••••••••••••••</span>
                <span className="sr-only">(zbytek klíče je skrytý)</span>
              </p>
              <SubmitButton name="intent" value="reveal" className="btn-secondary shrink-0" pendingText="Načítám…">
                Zobrazit klíč
              </SubmitButton>
            </div>
          )}
          <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="font-medium text-stone-700">Vytvořen</dt>
            <dd className="text-stone-600">{formatInTimeZone(activeKey.createdAt, activeKey.timeZone, DATE_FORMAT)}</dd>
            <dt className="font-medium text-stone-700">Naposledy použit</dt>
            <dd className="text-stone-600">
              {activeKey.lastUsedAt ? formatInTimeZone(activeKey.lastUsedAt, activeKey.timeZone, DATE_FORMAT) : "zatím nikdy"}
            </dd>
          </dl>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">
          Zatím nemáte žádný aktivní API klíč.
        </p>
      )}

      {confirming ? (
        <div
          role="group"
          aria-labelledby="api-key-confirm"
          className="flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p id="api-key-confirm" className="text-sm text-stone-700">
            {confirming === "revoke"
              ? "Opravdu zneplatnit klíč? Aplikace, které ho používají, okamžitě ztratí přístup."
              : "Vygenerovat nový klíč? Stávající klíč tím okamžitě přestane fungovat."}
          </p>
          <div className="flex shrink-0 gap-2">
            <button ref={cancelRef} type="button" onClick={() => setConfirming(null)} className="btn-secondary">
              Zpět
            </button>
            <SubmitButton
              name="intent"
              value={confirming}
              className={confirming === "revoke" ? "btn-danger" : "btn-primary"}
              pendingText={confirming === "revoke" ? "Zneplatňuji…" : "Generuji…"}
            >
              {confirming === "revoke" ? "Ano, zneplatnit" : "Ano, vygenerovat"}
            </SubmitButton>
          </div>
        </div>
      ) : activeKey ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfirming("create")} className="btn-secondary">
            Vygenerovat nový klíč
          </button>
          <button type="button" onClick={() => setConfirming("revoke")} className="btn-danger">
            Zneplatnit klíč
          </button>
        </div>
      ) : (
        <div>
          <SubmitButton name="intent" value="create" pendingText="Generuji…">
            Vygenerovat API klíč
          </SubmitButton>
        </div>
      )}
    </form>
  );
}
