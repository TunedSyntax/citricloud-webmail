import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Cable, CheckCircle2, Eye, EyeOff, History, Lock, Mail, Server, ShieldCheck } from "lucide-react";

import { detectProfile, getProfiles, login, type AuthSession, type ConnectionProfile, type MailFolder } from "../lib/api";
import type { SavedAccount } from "../App";
import logoUrl from "../assets/logo.svg";

type AccountSetupWizardProps = {
  lastActiveToken: string | null;
  onAuthenticated: (payload: { session: AuthSession; folders: MailFolder[] }) => void;
  onResumeAccount: (token: string) => void;
  recentAccounts: SavedAccount[];
  restoreError: string | null;
};

const defaultConnection = {
  host: "",
  port: 993,
  secure: true
};

function isLikelyEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function AccountSetupWizard({
  lastActiveToken,
  onAuthenticated,
  onResumeAccount,
  recentAccounts,
  restoreError
}: AccountSetupWizardProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string | undefined>();
  const [imap, setImap] = useState(defaultConnection);
  const [smtp, setSmtp] = useState({ host: "", port: 587, secure: false });
  const [advancedMode, setAdvancedMode] = useState(false);
  const lastDetectedEmailRef = useRef<string>("");

  const profilesQuery = useQuery({
    queryKey: ["profiles"],
    queryFn: getProfiles
  });

  const detectMutation = useMutation({
    mutationFn: ({ nextEmail }: { nextEmail: string }) => detectProfile(nextEmail),
    onSuccess: ({ profile }) => {
      setSelectedPreset(profile.key);
      setImap(profile.imap);
      setSmtp(profile.smtp);
    }
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: onAuthenticated
  });

  useEffect(() => {
    if (!profilesQuery.data?.profiles.length || selectedPreset) {
      return;
    }

    const firstProfile = profilesQuery.data.profiles[0];
    setSelectedPreset(firstProfile.key);
    setImap(firstProfile.imap);
    setSmtp(firstProfile.smtp);
  }, [profilesQuery.data, selectedPreset]);

  const recommendedProfile = detectMutation.data?.profile;
  const trimmedEmail = email.trim();
  const hasValidEmail = isLikelyEmail(trimmedEmail);
  const hasStrongEnoughPassword = password.length >= 8;
  const hasPreset = Boolean(selectedPreset);
  const hasCompleteHosts = Boolean(imap.host.trim()) && Boolean(smtp.host.trim());
  const canSubmit = hasValidEmail && hasStrongEnoughPassword && hasPreset && hasCompleteHosts && !loginMutation.isPending;
  const readinessItems = [
    { label: "Valid mailbox email", ready: hasValidEmail },
    { label: "Password length (8+)", ready: hasStrongEnoughPassword },
    { label: "Environment profile selected", ready: hasPreset },
    { label: "IMAP/SMTP hosts resolved", ready: hasCompleteHosts }
  ];

  const handleDetect = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      return;
    }

    lastDetectedEmailRef.current = normalizedEmail;
    detectMutation.mutate({ nextEmail: normalizedEmail });
  };

  useEffect(() => {
    const normalizedEmail = email.trim().toLowerCase();
    const hasAtSymbol = normalizedEmail.includes("@");

    if (!hasAtSymbol || normalizedEmail === lastDetectedEmailRef.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      lastDetectedEmailRef.current = normalizedEmail;
      detectMutation.mutate({ nextEmail: normalizedEmail });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [email, detectMutation]);

  const handlePresetChange = (profiles: ConnectionProfile[], nextPreset: string) => {
    setSelectedPreset(nextPreset);
    const profile = profiles.find((entry) => entry.key === nextPreset);

    if (profile) {
      setImap(profile.imap);
      setSmtp(profile.smtp);
    }
  };

  return (
    <section className="relative h-full overflow-y-auto border border-surface-200 bg-white/85 p-6 shadow-glow backdrop-blur xl:p-8">
      <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_right,_rgba(25,119,255,0.18),_transparent_55%)]" />
      <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <img src={logoUrl} alt="CitriCloud" className="h-10 w-auto" />
          <div className="inline-flex items-center gap-2 border border-brand-200 bg-brand-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-brand-700">
            <Cable className="h-4 w-4" />
            CitriCloud Setup Wizard
          </div>
          <div className="space-y-4">
            <h1 className="max-w-xl font-display text-4xl font-semibold tracking-tight text-surface-900 sm:text-5xl">
              Professional webmail for CitriCloud operations teams.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-surface-600 sm:text-lg">
              Detect the correct mail platform, validate IMAP and SMTP access through the proxy, and land directly in a focused dashboard styled for high-volume triage.
            </p>
            <p className="text-sm font-medium text-brand-700">Public webmail endpoint: webmail.citricloud.com</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["k3s-prod (internal)", "mail.citricloud.com", "Postfix / Dovecot"],
              ["k3s-mgmt (external)", "ems.citricloud.com", "Mailcow"],
              ["Webmail", "webmail.citricloud.com", "Public CitriCloud entrypoint"]
            ].map(([title, value, detail]) => (
              <article key={title} className="border border-surface-200 bg-white/80 p-4 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-surface-500">{title}</p>
                <p className="mt-3 text-lg font-semibold text-surface-900">{value}</p>
                <p className="mt-1 text-sm text-surface-600">{detail}</p>
              </article>
            ))}
          </div>

          <div className="border border-surface-200 bg-white/80 p-5 shadow-panel">
            <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">
              <History className="h-4 w-4" />
              Active sessions ({recentAccounts.length})
            </div>
            {recentAccounts.length ? (
              <div className="mt-4 grid gap-3">
                {recentAccounts.map((account) => (
                  <div key={account.session.token} className="flex flex-wrap items-center justify-between gap-3 border border-surface-200 bg-white px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-surface-900">{account.session.email}</p>
                        {account.session.token === lastActiveToken ? (
                          <span className="border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-700">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-surface-500">
                        {account.session.presetKey} · last active {new Date(account.session.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className="border border-brand-200 bg-brand-50 px-4 py-2 text-sm font-medium text-brand-700"
                      type="button"
                      onClick={() => onResumeAccount(account.session.token)}
                    >
                      Resume
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-surface-600">No active sessions found on this device yet.</p>
            )}
          </div>
        </div>

        <div className="border border-surface-200 bg-white p-6 shadow-panel">

          <div className="space-y-1">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Connect mailbox</p>
            <h2 className="font-display text-2xl font-semibold text-surface-900">Server-aware account onboarding</h2>
            <p className="pt-1 text-sm text-surface-600">Welcome back to CitriCloud Webmail. Sign in to continue with your mailbox operations.</p>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-surface-700">Email address</span>
              <div className="flex items-center gap-3 border border-surface-200 bg-surface-50 px-4 py-3">
                <Mail className="h-4 w-4 text-brand-600" />
                <input
                  className="w-full bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400"
                  placeholder="name@citricloud.com"
                  value={email}
                  onBlur={handleDetect}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-surface-700">Password</span>
              <div className="flex items-center gap-3 border border-surface-200 bg-surface-50 px-4 py-3">
                <Lock className="h-4 w-4 text-brand-600" />
                <input
                  className="w-full bg-transparent text-sm text-surface-900 outline-none placeholder:text-surface-400"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mailbox password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  className="border border-transparent p-1 text-surface-500 hover:border-surface-200 hover:bg-surface-100 hover:text-surface-700"
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-surface-500">Use your mailbox password. Your credentials are only used for IMAP/SMTP sign-in.</p>
            </label>

            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-surface-700">Environment preset</span>
                <select
                  className="w-full border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                  value={selectedPreset}
                  onChange={(event) => handlePresetChange(profilesQuery.data?.profiles ?? [], event.target.value)}
                >
                  {(profilesQuery.data?.profiles ?? []).map((profile) => (
                    <option key={profile.key} value={profile.key}>
                      {profile.label} ({profile.environment})
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="inline-flex h-[50px] items-center justify-center border border-brand-700 bg-brand-600 px-5 text-sm font-medium text-white transition hover:bg-brand-700"
                type="button"
                onClick={handleDetect}
              >
                Detect server
              </button>
            </div>

            {recommendedProfile ? (
              <div className="border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-800">
                Recommended profile: <strong>{recommendedProfile.label}</strong> routed to <strong>{recommendedProfile.imap.host}</strong>
              </div>
            ) : null}

            <div className="border border-surface-200 bg-surface-50/80 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-surface-600">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Preflight checks
              </div>
              <div className="mt-3 grid gap-2">
                {readinessItems.map((item) => (
                  <div key={item.label} className="flex items-center justify-between border border-surface-200 bg-white px-3 py-2 text-sm">
                    <span className="text-surface-700">{item.label}</span>
                    <span className={item.ready ? "text-emerald-700" : "text-amber-700"}>{item.ready ? "Ready" : "Missing"}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border border-surface-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Connection summary</p>
              <div className="mt-3 grid gap-2 text-sm text-surface-700">
                <p>
                  <strong>Email:</strong> {trimmedEmail || "Not provided"}
                </p>
                <p>
                  <strong>Preset:</strong> {selectedPreset ?? "Not selected"}
                </p>
                <p>
                  <strong>IMAP:</strong> {imap.host || "-"}:{imap.port} {imap.secure ? "(TLS)" : "(Plain)"}
                </p>
                <p>
                  <strong>SMTP:</strong> {smtp.host || "-"}:{smtp.port} {smtp.secure ? "(TLS)" : "(Plain)"}
                </p>
              </div>
            </div>

            <button
              className="text-sm font-medium text-brand-700"
              type="button"
              onClick={() => setAdvancedMode((current) => !current)}
            >
              {advancedMode ? "Hide manual connection settings" : "Override connection settings"}
            </button>

            {advancedMode ? (
              <div className="grid gap-4 border border-surface-200 bg-surface-50/80 p-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                    <Server className="h-4 w-4 text-brand-600" />
                    IMAP
                  </p>
                  <input
                    className="w-full border border-surface-200 bg-white px-4 py-3 text-sm outline-none"
                    value={imap.host}
                    onChange={(event) => setImap((current) => ({ ...current, host: event.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="border border-surface-200 bg-white px-4 py-3 text-sm outline-none"
                      type="number"
                      value={imap.port}
                      onChange={(event) => setImap((current) => ({ ...current, port: Number(event.target.value) }))}
                    />
                    <label className="flex items-center justify-center gap-2 border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700">
                      <input
                        checked={imap.secure}
                        type="checkbox"
                        onChange={(event) => setImap((current) => ({ ...current, secure: event.target.checked }))}
                      />
                      TLS
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold text-surface-700">
                    <Server className="h-4 w-4 text-brand-600" />
                    SMTP
                  </p>
                  <input
                    className="w-full border border-surface-200 bg-white px-4 py-3 text-sm outline-none"
                    value={smtp.host}
                    onChange={(event) => setSmtp((current) => ({ ...current, host: event.target.value }))}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      className="border border-surface-200 bg-white px-4 py-3 text-sm outline-none"
                      type="number"
                      value={smtp.port}
                      onChange={(event) => setSmtp((current) => ({ ...current, port: Number(event.target.value) }))}
                    />
                    <label className="flex items-center justify-center gap-2 border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700">
                      <input
                        checked={smtp.secure}
                        type="checkbox"
                        onChange={(event) => setSmtp((current) => ({ ...current, secure: event.target.checked }))}
                      />
                      TLS
                    </label>
                  </div>
                </div>
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center gap-2 border border-surface-900 bg-surface-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-surface-800 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
              type="button"
              onClick={() =>
                loginMutation.mutate({
                  email,
                  password,
                  presetKey: selectedPreset,
                  imap,
                  smtp
                })
              }
            >
              Validate and enter dashboard
              <ArrowRight className="h-4 w-4" />
            </button>

            {!hasValidEmail && trimmedEmail ? <p className="text-sm text-amber-700">Enter a valid email format (example: name@domain.com).</p> : null}
            {!hasStrongEnoughPassword && password ? <p className="text-sm text-amber-700">Password should contain at least 8 characters.</p> : null}

            {loginMutation.error ? <p className="text-sm text-rose-600">{loginMutation.error.message}</p> : null}
            {detectMutation.error ? <p className="text-sm text-rose-600">{detectMutation.error.message}</p> : null}
            {restoreError ? <p className="text-sm text-rose-600">{restoreError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}