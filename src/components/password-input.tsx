"use client";

import { useState } from "react";

type Props = Omit<React.ComponentProps<"input">, "type">;

/** Password field with a show/hide toggle. */
export function PasswordInput({ className = "input", ...rest }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input {...rest} type={visible ? "text" : "password"} className={`${className} pr-20`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-controls={rest.id}
        className="absolute inset-y-1 right-1 rounded-md px-2.5 text-xs font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 focus-visible:outline-2 focus-visible:outline-brand-600"
      >
        {visible ? "Skrýt" : "Zobrazit"}
        <span className="sr-only"> heslo</span>
      </button>
    </div>
  );
}
