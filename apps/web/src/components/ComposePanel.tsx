import { useEffect, useRef, useState } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Heading, Italic, Link2, Paintbrush, SendHorizontal, Type, Underline, X } from "lucide-react";

import type { DraftMessagePayload, SendMessagePayload } from "../lib/api";

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
  draftSavedAt?: string | null;
  isSavingDraft: boolean;
  isSending: boolean;
  onClose: () => void;
  onSaveDraft: (payload: Omit<DraftMessagePayload, "folder">) => void;
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

export function ComposePanel({ draft, errorMessage, draftSavedAt, isSavingDraft, isSending, onClose, onSaveDraft, onSend }: ComposePanelProps) {
  const [formState, setFormState] = useState<ComposeDraft | null>(draft);
  const [htmlBody, setHtmlBody] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const lastAutoSaveHashRef = useRef<string>("");
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

  const applyHeading = (heading: "h1" | "h2" | "h3" | "h4" | "p") => {
    applyEditorCommand("formatBlock", heading === "p" ? "<p>" : `<${heading}>`);
  };

  const applyLink = () => {
    const url = window.prompt("Enter URL", "https://");
    if (!url || !url.trim()) {
      return;
    }

    applyEditorCommand("createLink", url.trim());
  };

  const applyFontSizePx = (sizePx: number) => {
    if (!editorRef.current) {
      return;
    }

    editorRef.current.focus();
    document.execCommand("styleWithCSS", false, "true");
    document.execCommand("fontSize", false, "7");

    editorRef.current.querySelectorAll("font[size='7']").forEach((node) => {
      const element = node as HTMLElement;
      element.removeAttribute("size");
      element.style.fontSize = `${sizePx}px`;
    });

    setHtmlBody(editorRef.current.innerHTML);
  };

  const buildDraftPayload = () => {
    if (!formState) {
      return null;
    }

    const to = splitRecipients(formState.to);
    const cc = splitRecipients(formState.cc);
    const bcc = splitRecipients(formState.bcc);
    const text = editorRef.current?.innerText.trim() ?? "";
    const html = editorRef.current?.innerHTML.trim() ?? "";

    const payload: Omit<DraftMessagePayload, "folder"> = {
      to: to.length ? to : undefined,
      cc: cc.length ? cc : undefined,
      bcc: bcc.length ? bcc : undefined,
      subject: formState.subject || undefined,
      text: text || undefined,
      html: html && html !== "<br>" ? html : undefined,
      inReplyTo: formState.inReplyTo ?? undefined,
      references: formState.references?.length ? formState.references : undefined
    };

    const hasContent = Boolean(payload.subject || payload.text || payload.html || payload.to?.length || payload.cc?.length || payload.bcc?.length);
    return hasContent ? payload : null;
  };

  useEffect(() => {
    const payload = buildDraftPayload();
    if (!payload || isSending || isSavingDraft) {
      return;
    }

    const hash = JSON.stringify(payload);
    if (hash === lastAutoSaveHashRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      onSaveDraft(payload);
      lastAutoSaveHashRef.current = hash;
    }, 15000);

    return () => window.clearTimeout(timer);
  }, [formState, htmlBody, isSavingDraft, isSending, onSaveDraft]);

  if (!formState) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 hide-scrollbar overflow-y-auto bg-surface-900/30 p-4 backdrop-blur-sm">
      <div className="mx-auto flex min-h-full w-full items-start justify-center py-2 sm:py-4">
      <section className="hide-scrollbar flex h-[92vh] w-full max-w-3xl min-h-[560px] max-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] shadow-[0_30px_80px_rgba(11,33,65,0.24)] sm:h-[84vh]">
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

        <div className="min-h-0 flex-1 overflow-y-auto px-0 py-0 hide-scrollbar">
          <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-2 bg-white px-6 py-2">
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("bold")}>
              <Bold className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("italic")}>
              <Italic className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("underline")}>
              <Underline className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={applyLink}>
              <Link2 className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("justifyLeft")}>
              <AlignLeft className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("justifyCenter")}>
              <AlignCenter className="h-4 w-4" />
            </button>
            <button className="bg-white p-2 text-surface-700 hover:bg-surface-100" type="button" onClick={() => applyEditorCommand("justifyRight")}>
              <AlignRight className="h-4 w-4" />
            </button>

            <div className="ml-2 inline-flex items-center gap-2 bg-white px-2 py-1.5">
              <Heading className="h-4 w-4 text-surface-500" />
              <select className="bg-transparent text-sm outline-none" defaultValue="p" onChange={(event) => applyHeading(event.target.value as "h1" | "h2" | "h3" | "h4" | "p") }>
                <option value="p">Body</option>
                <option value="h4">H4</option>
                <option value="h3">H3</option>
                <option value="h2">H2</option>
                <option value="h1">H1</option>
              </select>
            </div>

            <div className="ml-2 inline-flex items-center gap-2 bg-white px-2 py-1.5">
              <Type className="h-4 w-4 text-surface-500" />
              <select className="bg-transparent text-sm outline-none" defaultValue="Inter" onChange={(event) => applyEditorCommand("fontName", event.target.value)}>
                <option value="Inter">Inter</option>
                <option value="Bricolage Grotesque">Bricolage Grotesque</option>
                <option value="Poppins">Poppins</option>
                <option value="Merriweather">Merriweather</option>
              </select>
              <select
                className="bg-transparent text-sm outline-none"
                defaultValue="16"
                onChange={(event) => applyFontSizePx(Number(event.target.value))}
              >
                {[8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 56, 64, 72].map((size) => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>

            <label className="ml-2 inline-flex cursor-pointer items-center gap-2 bg-white px-2 py-1.5 text-sm text-surface-700">
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
            className="hide-scrollbar h-full min-h-[220px] w-full overflow-y-auto bg-surface-50 px-6 py-4 text-sm leading-7 outline-none"
            contentEditable
            dangerouslySetInnerHTML={{ __html: htmlBody }}
            onInput={(event) => setHtmlBody((event.target as HTMLDivElement).innerHTML)}
          />
        </div>

        <footer className="shrink-0 border-t border-surface-200 bg-white/90 px-6 py-5 backdrop-blur">
          {validationMessage ? <p className="mb-3 text-sm text-rose-600">{validationMessage}</p> : null}
          {errorMessage ? <p className="mb-3 text-sm text-rose-600">{errorMessage}</p> : null}
          {draftSavedAt ? <p className="mb-3 text-sm text-emerald-600">Draft saved at {draftSavedAt}</p> : null}
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-surface-500">Separate multiple recipients with commas.</p>
            <div className="flex gap-3">
              <button className="rounded-2xl border border-surface-200 px-4 py-3 text-sm font-medium text-surface-700" type="button" onClick={onClose}>
                Cancel
              </button>
              <button
                className="rounded-2xl border border-brand-200 px-4 py-3 text-sm font-medium text-brand-700 disabled:opacity-60"
                disabled={isSavingDraft}
                type="button"
                onClick={() => {
                  const payload = buildDraftPayload();
                  if (!payload) {
                    setValidationMessage("Add content before saving a draft.");
                    return;
                  }

                  setValidationMessage(null);
                  onSaveDraft(payload);
                }}
              >
                {isSavingDraft ? "Saving..." : "Send to Draft"}
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
    </div>
  );
}
