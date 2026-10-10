"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";
import { slugify } from "@/lib/format";
import { SLOT_STEPS, type ActionState } from "@/lib/constants";
import type { Business } from "@/lib/database.types";

type Props = {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  business?: Business;
  submitLabel: string;
  /** Host shown in front of the slug, e.g. "rezervo.vercel.app" */
  siteHost: string;
};

export function BusinessForm({ action, business, submitLabel, siteHost }: Props) {
  const [state, formAction] = useActionState(action, undefined);
  const [name, setName] = useState(business?.name ?? "");
  const [slug, setSlug] = useState(business?.slug ?? "");
  // Auto-derive the slug from the name until the owner edits it by hand.
  const [slugTouched, setSlugTouched] = useState(Boolean(business));

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="name" className="label">
          Název podniku
        </label>
        <input
          id="name"
          name="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugTouched) setSlug(slugify(e.target.value));
          }}
          placeholder="např. Kadeřnictví U Nůžek…"
          className="input"
        />
      </div>

      <div>
        <label htmlFor="slug" className="label">
          Adresa rezervační stránky
        </label>
        <div className="flex rounded-lg shadow-xs">
          <span className="inline-flex items-center rounded-l-lg border border-r-0 border-stone-300 bg-stone-50 px-3 text-sm text-stone-500">
            {siteHost}/
          </span>
          <input
            id="slug"
            name="slug"
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            title="Malá písmena bez diakritiky, číslice a pomlčky"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
            className="input rounded-l-none shadow-none"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className="label">
            Telefon <span className="font-normal text-stone-400">(nepovinné)</span>
          </label>
          <input id="phone" name="phone" type="tel" maxLength={30} defaultValue={business?.phone ?? ""} className="input" />
        </div>
        <div>
          <label htmlFor="address" className="label">
            Adresa <span className="font-normal text-stone-400">(nepovinné)</span>
          </label>
          <input id="address" name="address" maxLength={200} defaultValue={business?.address ?? ""} className="input" />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="label">
          Krátký popis <span className="font-normal text-stone-400">(nepovinné)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          maxLength={500}
          defaultValue={business?.description ?? ""}
          className="input"
        />
      </div>

      {business && (
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="notification_email" className="label">
              E-mail pro upozornění na rezervace
            </label>
            <input
              id="notification_email"
              name="notification_email"
              type="email"
              spellCheck={false}
              autoCapitalize="none"
              required
              defaultValue={business.notification_email}
              className="input"
            />
          </div>
          <div>
            <label htmlFor="slot_step_minutes" className="label">
              Nabízet začátky termínů po
            </label>
            <select
              id="slot_step_minutes"
              name="slot_step_minutes"
              defaultValue={business.slot_step_minutes}
              className="input"
            >
              {SLOT_STEPS.map((step) => (
                <option key={step} value={step}>
                  {step} minutách
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <FormMessage state={state} />
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
