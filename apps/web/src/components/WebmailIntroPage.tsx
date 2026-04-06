import { ArrowRight, CheckCircle2, Globe, Lock, RefreshCcw, ShieldCheck, Tags } from "lucide-react";

import logoUrl from "../assets/logo.svg";

type WebmailIntroPageProps = {
  onContinue: () => void;
};

export function WebmailIntroPage({ onContinue }: WebmailIntroPageProps) {
  return (
    <section className="relative h-full overflow-y-auto border border-surface-200 bg-white/85 p-6 shadow-glow backdrop-blur xl:p-8">
      <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,_rgba(25,119,255,0.18),_transparent_55%)]" />
      <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <img src={logoUrl} alt="CitriCloud" className="h-10 w-auto" />
          <div className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
            <Globe className="h-4 w-4" />
            CitriCloud Webmail Overview
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl font-display text-4xl font-semibold tracking-tight text-surface-900 sm:text-5xl">
              One secure mailbox workspace for triage, response, and operations continuity.
            </h1>
            <p className="max-w-3xl text-base leading-7 text-surface-600 sm:text-lg">
              CitriCloud Webmail connects through your configured IMAP and SMTP profiles, restores previous sessions safely,
              and gives teams a structured dashboard for high-volume communication handling.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Step 1", "Info page", "Review platform capabilities and connection model"],
              ["Step 2", "Login", "Authenticate mailbox credentials and validate routes"],
              ["Step 3", "Webmail", "Operate from folder-aware, filter-driven mailbox UI"]
            ].map(([title, value, detail]) => (
              <article key={title} className="rounded-2xl border border-surface-200 bg-white p-4 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">{title}</p>
                <p className="mt-2 text-lg font-semibold text-surface-900">{value}</p>
                <p className="mt-1 text-sm text-surface-600">{detail}</p>
              </article>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-2xl border border-surface-200 bg-white p-4 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">How it works</p>
              <ul className="mt-3 space-y-2 text-sm text-surface-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  Auto-detect profile by domain and resolve IMAP/SMTP endpoints.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  Validate credentials through proxy before entering dashboard.
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-600" />
                  Persist account session metadata for quick resume on next visit.
                </li>
              </ul>
            </article>

            <article className="rounded-2xl border border-surface-200 bg-white p-4 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Webmail features</p>
              <ul className="mt-3 space-y-2 text-sm text-surface-700">
                <li className="flex items-start gap-2">
                  <Tags className="mt-0.5 h-4 w-4 text-brand-600" />
                  Smart filters: category, status, date ranges, provider/subdomain.
                </li>
                <li className="flex items-start gap-2">
                  <RefreshCcw className="mt-0.5 h-4 w-4 text-brand-600" />
                  Folder/message refresh controls with configurable intervals.
                </li>
                <li className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-brand-600" />
                  Spam folder monitoring indicator with rspamd context.
                </li>
              </ul>
            </article>
          </div>
        </div>

        <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-panel">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Before login</p>
            <h2 className="font-display text-2xl font-semibold text-surface-900">Connection and security summary</h2>
            <p className="text-sm text-surface-600">
              This client uses your selected environment profile, validates IMAP and SMTP routes, and only then opens your mailbox dashboard.
            </p>
          </div>

          <div className="mt-5 grid gap-3">
            {[
              {
                title: "Authentication",
                detail: "Email + mailbox password validation before dashboard entry",
                Icon: Lock
              },
              {
                title: "Transport",
                detail: "TLS flags are shown and configurable in advanced login settings",
                Icon: ShieldCheck
              },
              {
                title: "Data handling",
                detail: "Session details stored locally to restore your active account quickly",
                Icon: CheckCircle2
              },
              {
                title: "Operational UI",
                detail: "Date grouped messages, advanced filters, bulk actions, and label sync",
                Icon: Tags
              }
            ].map(({ title, detail, Icon }) => (
              <div key={title} className="rounded-xl border border-surface-200 bg-surface-50 p-3 shadow-panel">
                <p className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                  <Icon className="h-4 w-4 text-brand-700" />
                  {title}
                </p>
                <p className="mt-1 text-xs leading-5 text-surface-600">{detail}</p>
              </div>
            ))}
          </div>

          <button
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-surface-900 bg-surface-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-surface-800"
            type="button"
            onClick={onContinue}
          >
            Continue to Login
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
