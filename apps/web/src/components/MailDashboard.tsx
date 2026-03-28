import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  CirclePlus,
  ChevronDown,
  Inbox,
  LayoutPanelTop,
  LogOut,
  Reply,
  Search,
  Send,
  ShieldAlert,
  Star,
  Tags,
  Trash2,
  UserCircle2
} from "lucide-react";

import {
  deleteMessage as deleteMessageRequest,
  getFolders,
  getEnvironmentVersions,
  getMessage,
  getMessages,
  logout as logoutRequest,
  moveMessage as moveMessageRequest,
  sendMessage as sendMessageRequest,
  type AuthSession,
  type EnvironmentVersions,
  type MailFolder,
  type MessageDetail,
  type SendMessagePayload
} from "../lib/api";
import type { SavedAccount } from "../App";
import { ComposePanel, type ComposeDraft } from "./ComposePanel";
import logoUrl from "../assets/logo.svg";

type MailDashboardProps = {
  session: AuthSession;
  initialFolders: MailFolder[];
  savedAccounts: SavedAccount[];
  onResumeAccount: (token: string) => void;
  onSignedOut: (token: string) => void;
  onAddAccount: () => void;
};

const sidebarItems = [
  { label: "Inbox", icon: Inbox, fallback: "INBOX" },
  { label: "Sent", icon: Send, fallback: "Sent" },
  { label: "Drafts", icon: LayoutPanelTop, fallback: "Drafts" },
  { label: "Trash", icon: Trash2, fallback: "Trash" },
  { label: "Spam", icon: ShieldAlert, fallback: "Junk" },
  { label: "Labels", icon: Tags, fallback: "Archive" }
];

function buildReplyBody(detail: MessageDetail): string {
  const timestamp = detail.date ? new Date(detail.date).toLocaleString() : "an earlier time";
  const originalBody = detail.text || "Original message content is not available in plain text.";
  const quotedBody = originalBody
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `\n\nOn ${timestamp}, ${detail.from} wrote:\n${quotedBody}`;
}

export function MailDashboard({
  session,
  initialFolders,
  savedAccounts,
  onResumeAccount,
  onSignedOut,
  onAddAccount
}: MailDashboardProps) {
  const [activeFolder, setActiveFolder] = useState(initialFolders[0]?.path ?? "INBOX");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [readingPane, setReadingPane] = useState<"right" | "bottom">("right");
  const [filterUnread, setFilterUnread] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ops" | "security" | "billing">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "flagged">("all");
  const [composerDraft, setComposerDraft] = useState<ComposeDraft | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  const foldersQuery = useQuery({
    queryKey: ["folders", session.token],
    queryFn: () => getFolders(session.token),
    initialData: { folders: initialFolders }
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", session.token, activeFolder],
    queryFn: () => getMessages(session.token, activeFolder)
  });

  const selectedMessageQuery = useQuery({
    queryKey: ["message", session.token, activeFolder, selectedUid],
    queryFn: () => getMessage(session.token, activeFolder, selectedUid as number),
    enabled: selectedUid !== null
  });

  const versionsQuery = useQuery<EnvironmentVersions>({
    queryKey: ["environment-versions"],
    queryFn: getEnvironmentVersions,
    staleTime: 5 * 60 * 1000
  });

  const deleteMutation = useMutation({
    mutationFn: (uid: number) => deleteMessageRequest(session.token, activeFolder, uid),
    onSuccess: () => {
      messagesQuery.refetch();
      setSelectedUid(null);
    }
  });

  const moveMutation = useMutation({
    mutationFn: (uid: number) => moveMessageRequest(session.token, activeFolder, uid, "Archive"),
    onSuccess: () => {
      messagesQuery.refetch();
      setSelectedUid(null);
    }
  });

  const sendMutation = useMutation({
    mutationFn: (payload: SendMessagePayload) => sendMessageRequest(session.token, payload),
    onSuccess: () => {
      setComposerDraft(null);
      messagesQuery.refetch();
    }
  });

  const logoutMutation = useMutation({
    mutationFn: () => logoutRequest(session.token),
    onSettled: () => {
      onSignedOut(session.token);
      setAccountMenuOpen(false);
    }
  });

  useEffect(() => {
    if (messagesQuery.data?.messages.length && selectedUid === null) {
      setSelectedUid(messagesQuery.data.messages[0].uid);
    }
  }, [messagesQuery.data, selectedUid]);

  const filteredMessages = useMemo(() => {
    const now = Date.now();
    const categoryKeywords: Record<"ops" | "security" | "billing", string[]> = {
      ops: ["ops", "operation", "outage", "incident", "oncall", "deployment", "infra"],
      security: ["security", "auth", "phish", "breach", "vulnerability", "alert", "spam"],
      billing: ["billing", "invoice", "payment", "receipt", "subscription", "charge"]
    };

    return (messagesQuery.data?.messages ?? []).filter((message) => {
      if (filterUnread && !message.unread) {
        return false;
      }

      if (statusFilter === "unread" && !message.unread) {
        return false;
      }

      if (statusFilter === "flagged" && !message.flagged) {
        return false;
      }

      if (dateRange !== "all") {
        if (!message.date) {
          return false;
        }

        const messageDate = new Date(message.date).getTime();
        const ageMs = now - messageDate;

        if (dateRange === "today") {
          const startOfToday = new Date();
          startOfToday.setHours(0, 0, 0, 0);
          if (messageDate < startOfToday.getTime()) {
            return false;
          }
        }

        if (dateRange === "7d" && ageMs > 7 * 24 * 60 * 60 * 1000) {
          return false;
        }

        if (dateRange === "30d" && ageMs > 30 * 24 * 60 * 60 * 1000) {
          return false;
        }
      }

      if (categoryFilter !== "all") {
        const categoryHaystack = `${message.subject} ${message.from} ${message.preview}`.toLowerCase();
        if (!categoryKeywords[categoryFilter].some((keyword) => categoryHaystack.includes(keyword))) {
          return false;
        }
      }

      if (!searchText) {
        return true;
      }

      const haystack = `${message.subject} ${message.from} ${message.preview}`.toLowerCase();
      return haystack.includes(searchText.toLowerCase());
    });
  }, [filterUnread, messagesQuery.data?.messages, searchText]);

  const detail = selectedMessageQuery.data?.message;
  const switchableAccounts = savedAccounts.filter((account) => account.session.token !== session.token);

  const openNewComposer = () => {
    setComposerDraft({
      mode: "compose",
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: ""
    });
  };

  const openReplyComposer = () => {
    if (!detail) {
      return;
    }

    setComposerDraft({
      mode: "reply",
      to: detail.replyTo.join(", "),
      cc: "",
      bcc: "",
      subject: detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`,
      body: buildReplyBody(detail),
      inReplyTo: detail.messageId,
      references: detail.references
    });
  };

  return (
    <>
      <section className="grid h-full min-h-screen grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden bg-white/80 shadow-glow backdrop-blur">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-surface-200 px-6 py-4">
        <div className="flex items-center gap-4">
          <img src={logoUrl} alt="CitriCloud" className="h-8 w-auto" />
          <h2 className="text-xl font-semibold text-surface-900">Operational inbox</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
            <Search className="h-4 w-4 text-brand-600" />
            <input
              className="w-56 bg-transparent text-sm outline-none placeholder:text-surface-400"
              placeholder="Search by sender, subject, or preview"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>
          <button
            className={`rounded-2xl px-4 py-3 text-sm font-medium ${filterUnread ? "bg-brand-600 text-white" : "border border-surface-200 bg-white text-surface-700"}`}
            type="button"
            onClick={() => setFilterUnread((current) => !current)}
          >
            Unread
          </button>
          <button
            className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm font-medium text-surface-700"
            type="button"
            onClick={() => setReadingPane((current) => (current === "right" ? "bottom" : "right"))}
          >
            Pane: {readingPane}
          </button>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white" type="button" onClick={openNewComposer}>
            New Message
          </button>
          <div className="relative">
            <button
              className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700"
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
            >
              <UserCircle2 className="h-5 w-5 text-brand-600" />
              {session.email}
              <ChevronDown className="h-4 w-4" />
            </button>

            {accountMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 rounded-3xl border border-surface-200 bg-white p-3 shadow-panel">
                <div className="border-b border-surface-200 px-3 pb-3">
                  <p className="text-sm font-semibold text-surface-900">{session.email}</p>
                  <p className="text-xs text-surface-500">Current session · {session.presetKey}</p>
                </div>

                <div className="px-3 py-3">
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-surface-700 transition hover:bg-surface-50"
                    type="button"
                    onClick={() => {
                      setAccountMenuOpen(false);
                      onAddAccount();
                    }}
                  >
                    <CirclePlus className="h-4 w-4 text-brand-600" />
                    Add another account
                  </button>
                </div>

                {switchableAccounts.length ? (
                  <div className="border-t border-surface-200 px-3 py-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Switch account</p>
                    <div className="space-y-2">
                      {switchableAccounts.map((account) => (
                        <button
                          key={account.session.token}
                          className="w-full rounded-2xl border border-surface-200 px-3 py-2 text-left transition hover:border-brand-200 hover:bg-brand-50"
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            onResumeAccount(account.session.token);
                          }}
                        >
                          <p className="text-sm font-medium text-surface-900">{account.session.email}</p>
                          <p className="text-xs text-surface-500">{account.session.presetKey}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="border-t border-surface-200 px-3 pt-3">
                  <button
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                    disabled={logoutMutation.isPending}
                    type="button"
                    onClick={() => logoutMutation.mutate()}
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <div className={`grid min-h-0 ${readingPane === "right" ? "xl:grid-cols-[240px_290px_minmax(0,1fr)]" : "xl:grid-cols-[240px_minmax(0,1fr)]"}`}>
        <aside className="flex min-h-0 flex-col overflow-y-auto border-r border-surface-200 bg-[linear-gradient(180deg,#0b2141,#14345f)] p-5 text-white">
          <div className="mb-6 rounded-3xl bg-white/10 p-4 backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-100">Connected environment</p>
            <p className="mt-3 text-lg font-semibold">{session.presetKey}</p>
            <p className="text-sm text-brand-100">{session.email}</p>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const LucideIcon = item.icon;
              const matchingFolder = foldersQuery.data?.folders.find((folder) =>
                folder.path.toLowerCase().includes(item.fallback.toLowerCase()) || folder.name.toLowerCase() === item.label.toLowerCase()
              );
              const targetFolder = matchingFolder?.path ?? item.fallback;

              return (
                <button
                  key={item.label}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    activeFolder === targetFolder ? "bg-white text-brand-700" : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                  type="button"
                  onClick={() => {
                    setActiveFolder(targetFolder);
                    setSelectedUid(null);
                  }}
                >
                  <LucideIcon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-100">Advanced filters</p>
            <div className="mt-4 space-y-3 text-sm text-white/80">
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">Date</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["today", "Today"],
                    ["7d", "7d"],
                    ["30d", "30d"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-xl px-3 py-1.5 text-xs ${dateRange === value ? "bg-white text-brand-700" : "bg-white/10 text-white hover:bg-white/20"}`}
                      type="button"
                      onClick={() => setDateRange(value as "all" | "today" | "7d" | "30d")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">Category</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["ops", "Ops"],
                    ["security", "Security"],
                    ["billing", "Billing"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-xl px-3 py-1.5 text-xs ${categoryFilter === value ? "bg-white text-brand-700" : "bg-white/10 text-white hover:bg-white/20"}`}
                      type="button"
                      onClick={() => setCategoryFilter(value as "all" | "ops" | "security" | "billing")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.2em] text-brand-100">Status</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    ["all", "All"],
                    ["unread", "Unread"],
                    ["flagged", "Flagged"]
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`rounded-xl px-3 py-1.5 text-xs ${statusFilter === value ? "bg-white text-brand-700" : "bg-white/10 text-white hover:bg-white/20"}`}
                      type="button"
                      onClick={() => setStatusFilter(value as "all" | "unread" | "flagged")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </aside>

        <div className={`grid min-h-0 ${readingPane === "right" ? "grid-cols-[290px_minmax(0,1fr)] xl:col-span-2" : "grid-rows-[320px_minmax(0,1fr)] xl:col-span-1"}`}>
          <section className="flex min-h-0 flex-col border-r border-surface-200 bg-white">
            <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-surface-900">{activeFolder}</p>
                <p className="text-xs text-surface-500">{filteredMessages.length} messages</p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-700"
                  disabled={selectedUid === null || deleteMutation.isPending}
                  type="button"
                  onClick={() => selectedUid !== null && deleteMutation.mutate(selectedUid)}
                >
                  Delete
                </button>
                <button
                  className="rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-700"
                  disabled={selectedUid === null || moveMutation.isPending}
                  type="button"
                  onClick={() => selectedUid !== null && moveMutation.mutate(selectedUid)}
                >
                  Move
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredMessages.map((message) => (
                <button
                  key={message.uid}
                  className={`flex w-full items-start gap-3 border-b border-surface-100 px-3 py-2.5 text-left transition hover:bg-brand-50 ${
                    selectedUid === message.uid ? "bg-brand-50" : "bg-white"
                  }`}
                  type="button"
                  onClick={() => setSelectedUid(message.uid)}
                >
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <div className={`h-2.5 w-2.5 rounded-full ${message.unread ? "bg-brand-600" : "bg-surface-200"}`} />
                    {message.flagged ? <Star className="h-3.5 w-3.5 shrink-0 text-amber-500" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-medium text-surface-700">{message.from}</p>
                      <p className="shrink-0 text-[11px] text-surface-500">{message.date ? new Date(message.date).toLocaleDateString() : "Now"}</p>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-semibold text-surface-900">{message.subject}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 bg-[linear-gradient(180deg,#f7fafe,#eef4fc)] p-6">
            {detail ? (
              <article className="flex h-full min-h-0 flex-col bg-white/85 p-6 shadow-panel backdrop-blur">
                <div className="flex items-start justify-between gap-6 border-b border-surface-200 pb-5">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">Message detail</p>
                    <h3 className="mt-2 text-3xl font-semibold text-surface-900">{detail.subject}</h3>
                    <p className="mt-3 text-sm text-surface-600">From {detail.from}</p>
                    <p className="text-sm text-surface-500">To {detail.to}</p>
                    {detail.cc ? <p className="text-sm text-surface-500">Cc {detail.cc}</p> : null}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-xl bg-brand-50 px-3 py-2 text-right text-xs text-brand-700">
                      <p>{detail.date ? new Date(detail.date).toLocaleString() : "No timestamp"}</p>
                      <p className="font-medium">{detail.unread ? "Unread" : "Read"}</p>
                    </div>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-brand-200 bg-white px-4 py-2 text-sm font-medium text-brand-700"
                      type="button"
                      onClick={openReplyComposer}
                    >
                      <Reply className="h-4 w-4" />
                      Reply
                    </button>
                  </div>
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-50 p-6 text-sm leading-7 text-surface-700">
                  {detail.html ? (
                    <div dangerouslySetInnerHTML={{ __html: detail.html }} />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans">{detail.text || "No body available."}</pre>
                  )}
                </div>
              </article>
            ) : (
              <div className="flex h-full items-center justify-center bg-white/70 text-surface-500">
                Select a message to open the reading pane.
              </div>
            )}
          </section>
        </div>
      </div>

      <footer className="w-full border-t border-surface-200 bg-white px-6 py-2.5 text-xs text-surface-600">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            Copyright CITRICLOUD · <a className="font-semibold text-brand-700 hover:underline" href="https://citricloud.com" rel="noreferrer" target="_blank">citricloud.com</a>
          </p>
          <div className="flex flex-wrap items-center gap-4 text-surface-500">
            <p>DEV (dev.webmail.citricloud.com): {versionsQuery.data?.dev ?? "Loading..."}</p>
            <p>STAGING (staging.webmail.citricloud.com): {versionsQuery.data?.staging ?? "Loading..."}</p>
            <p>PROD (webmail.citricloud.com): {versionsQuery.data?.prod ?? "Loading..."}</p>
          </div>
        </div>
      </footer>
      </section>

      <ComposePanel
        draft={composerDraft}
        errorMessage={sendMutation.error?.message}
        isSending={sendMutation.isPending}
        onClose={() => setComposerDraft(null)}
        onSend={(payload) => sendMutation.mutate(payload)}
      />
    </>
  );
}