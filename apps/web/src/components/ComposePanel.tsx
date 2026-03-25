import { useEffect, useState } from "react";
import { SendHorizontal, X } from "lucide-react";

import type { SendMessagePayload } from "../lib/api";

export type ComposeDraft = {
  mode: "compose" | "reply";
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  inReplyTo?: string | null;
  references?: string[];
};

type ComposePanelProps = {
  draft: ComposeDraft | null;
  errorMessage?: string;
  isSending: boolean;
  onClose: () => void;
  onSend: (payload: SendMessagePayload) => void;
};

function splitRecipients(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function ComposePanel({ draft, errorMessage, isSending, onClose, onSend }: ComposePanelProps) {
  const [formState, setFormState] = useState<ComposeDraft | null>(draft);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(draft);
    setValidationMessage(null);
  }, [draft]);

  if (!formState) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-surface-900/30 backdrop-blur-sm sm:items-center sm:pr-6">
      <section className="flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(11,33,65,0.24)] sm:h-[82vh] sm:rounded-[28px]">
        <header className="flex items-center justify-between border-b border-surface-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-700">
              {formState.mode === "reply" ? "Reply" : "Compose"}
            </p>
            <h3 className="mt-1 text-2xl font-semibold text-surface-900">
              {formState.mode === "reply" ? "Respond to message" : "New message"}
            </h3>
          </div>
          <button className="rounded-2xl border border-surface-200 p-3 text-surface-600" type="button" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="grid gap-4 border-b border-surface-200 px-6 py-5">
          {[
            ["To", "to", "name@example.com"],
            ["Cc", "cc", "Optional"],
            ["Bcc", "bcc", "Optional"]
          ].map(([label, key, placeholder]) => (
            <label key={label} className="grid gap-2 md:grid-cols-[64px_minmax(0,1fr)] md:items-center">
              <span className="text-sm font-medium text-surface-700">{label}</span>
              <input
                className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none"
                placeholder={placeholder}
                value={formState[key as keyof ComposeDraft] as string}
                onChange={(event) =>
                  setFormState((current) =>
                    current
                      ? {
                          ...current,
                          [key]: event.target.value
                        }
                      : current
                  )
                }
              />
            </label>
          ))}

          <label className="grid gap-2 md:grid-cols-[64px_minmax(0,1fr)] md:items-center">
            <span className="text-sm font-medium text-surface-700">Subject</span>
            <input
              className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm outline-none"
              placeholder="Subject"
              value={formState.subject}
              onChange={(event) =>
                setFormState((current) =>
                  current
                    ? {
                        ...current,
                        subject: event.target.value
                      }
                    : current
                )
              }
            />
          </label>
        </div>

        <div className="flex-1 px-6 py-5">
          <textarea
            className="h-full min-h-[280px] w-full resize-none rounded-[24px] border border-surface-200 bg-surface-50 px-5 py-4 text-sm leading-7 outline-none"
            placeholder="Write your message"
            value={formState.body}
            onChange={(event) =>
              setFormState((current) =>
                current
                  ? {
                      ...current,
                      body: event.target.value
                    }
                  : current
              )
            }
          />
        </div>

        <footer className="border-t border-surface-200 px-6 py-5">
          {validationMessage ? <p className="mb-3 text-sm text-rose-600">{validationMessage}</p> : null}
          {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-surface-500">Separate multiple recipients with commas.</p>
            <div className="flex gap-3">
              <button className="rounded-2xl border border-surface-200 px-4 py-3 text-sm font-medium text-surface-700" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending}
                type="button"
                onClick={() => {
                  const to = splitRecipients(formState.to);
                  const cc = splitRecipients(formState.cc);
                  const bcc = splitRecipients(formState.bcc);

                  if (!to.length) {
                    setValidationMessage("At least one recipient is required.");
                    return;
                  }

                  if (!formState.subject.trim()) {
                    setValidationMessage("A subject is required.");
                    return;
                  }

                  setValidationMessage(null);
                  onSend({
                    to,
                    cc: cc.length ? cc : undefined,
                    bcc: bcc.length ? bcc : undefined,
                    subject: formState.subject,
                    text: formState.body,
                    inReplyTo: formState.inReplyTo ?? undefined,
                    references: formState.references?.length ? formState.references : undefined
                  });
                }}
              >
                Send
                <SendHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        </footer>
      </section>
    </div>
  );
}