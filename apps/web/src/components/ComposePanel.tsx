import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Paintbrush, SendHorizontal, Type, Underline, X } from "lucide-react";

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

function escapeHtml(text: string) {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function textToHtml(text: string) {
  if (!text.trim()) {
    return "<p><br></p>";
  }

  return text
    .split("\n\n")
    .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
    .join("");
}

export function ComposePanel({ draft, errorMessage, isSending, onClose, onSend }: ComposePanelProps) {
  const [formState, setFormState] = useState<ComposeDraft | null>(draft);
  const [htmlBody, setHtmlBody] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setFormState(draft);
    setHtmlBody(draft?.body ? textToHtml(draft.body) : "<p><br></p>");
    setValidationMessage(null);
  }, [draft]);

  const applyEditorCommand = (command: string, value?: string) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand(command, false, value);
    setHtmlBody(editorRef.current.innerHTML);
  };

  if (!formState) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 hide-scrollbar overflow-y-auto bg-surface-900/30 p-4 backdrop-blur-sm">
      <section className="hide-scrollbar mx-auto flex h-[92vh] w-full max-w-3xl min-h-[560px] flex-col overflow-y-auto rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_30px_80px_rgba(11,33,65,0.24)] sm:h-[84vh]">
        <header className="flex shrink-0 items-center justify-between border-b border-surface-200 px-6 py-5">
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

        <div className="grid shrink-0 gap-4 border-b border-surface-200 px-6 py-5">
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

        <div className="min-h-0 flex-1 px-6 py-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-surface-200 bg-white p-2 shadow-sm">
            <button className="rounded-xl border border-surface-200 bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("bold")}>
              <Bold className="h-4 w-4" />
            </button>
            <button className="rounded-xl border border-surface-200 bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("italic")}>
              <Italic className="h-4 w-4" />
            </button>
            <button className="rounded-xl border border-surface-200 bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("underline")}>
              <Underline className="h-4 w-4" />
            </button>

            <div className="ml-2 inline-flex items-center gap-2 rounded-xl border border-surface-200 bg-white px-2 py-1.5">
              <Type className="h-4 w-4 text-surface-500" />
              <select
                className="bg-transparent text-sm outline-none"
                defaultValue="3"
                onChange={(event) => applyEditorCommand("fontSize", event.target.value)}
              >
                <option value="2">Small</option>
                <option value="3">Normal</option>
                <option value="4">Large</option>
                <option value="5">XL</option>
              </select>
            </div>

            <label className="ml-2 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-surface-200 bg-white px-2 py-1.5 text-sm text-surface-700">
              <Paintbrush className="h-4 w-4 text-surface-500" />
              Color
              <input
                className="h-5 w-5 cursor-pointer border-0 bg-transparent p-0"
                defaultValue="#131a22"
                type="color"
                onChange={(event) => applyEditorCommand("foreColor", event.target.value)}
              />
            </label>
          </div>

          <div
            ref={editorRef}
            aria-label="Message body editor"
            className="hide-scrollbar h-full min-h-[220px] w-full overflow-y-auto rounded-[24px] border border-surface-200 bg-surface-50 px-5 py-4 text-sm leading-7 outline-none"
            contentEditable
            dangerouslySetInnerHTML={{ __html: htmlBody }}
            onInput={(event) => setHtmlBody((event.target as HTMLDivElement).innerHTML)}
          />
        </div>

        <footer className="shrink-0 border-t border-surface-200 bg-white/90 px-6 py-5 backdrop-blur">
          {validationMessage ? <p className="mb-3 text-sm text-rose-600">{validationMessage}</p> : null}
          {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-surface-500">Separate multiple recipients with commas.</p>
            <div className="flex gap-3">
              <button className="rounded-2xl border border-surface-200 px-4 py-3 text-sm font-medium text-surface-700" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-400 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSending}
                type="button"
                onClick={() => {
                  const to = splitRecipients(formState.to);
                  const cc = splitRecipients(formState.cc);
                  const bcc = splitRecipients(formState.bcc);
                  const text = editorRef.current?.innerText.trim() ?? "";
                  const html = editorRef.current?.innerHTML.trim() ?? "";

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
                    text: text || undefined,
                    html: html && html !== "<br>" ? html : undefined,
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
