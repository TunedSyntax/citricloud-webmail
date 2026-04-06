import { useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Bell,
  Bookmark,
  Briefcase,
  CalendarDays,
  Check,
  CheckSquare,
  CirclePlus,
  ChevronDown,
  Cog,
  Flag,
  FolderPlus,
  Forward,
  Globe,
  Heart,
  Inbox,
  LayoutPanelTop,
  Lightbulb,
  LogOut,
  MapPin,
  Megaphone,
  MoreVertical,
  PanelBottom,
  PanelRight,
  Paperclip,
  Pencil,
  RefreshCcw,
  Reply,
  Rocket,
  Search,
  Send,
  ShieldAlert,
  Square,
  Star,
  Tag,
  Tags,
  Trash2,
  UserCircle2,
  Zap
} from "lucide-react";

import {
  createFolder as createFolderRequest,
  deleteMessage as deleteMessageRequest,
  deleteFolder as deleteFolderRequest,
  getFolders,
  getMessageAttachmentContent,
  getEnvironmentVersions,
  getMessage,
  getMessages,
  logout as logoutRequest,
  moveMessagesBatch as moveMessagesBatchRequest,
  moveMessage as moveMessageRequest,
  saveDraftMessage as saveDraftMessageRequest,
  sendMessage as sendMessageRequest,
  updateMessageFlags as updateMessageFlagsRequest,
  type AuthSession,
  type DraftMessagePayload,
  type EnvironmentVersions,
  type MailFolder,
  type MoveBatchItem,
  type MessageAttachment,
  type MessageDetail,
  type MessagePreview,
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

type UserLabel = {
  id: string;
  name: string;
  colorIndex: number;
  iconIndex: number;
};

type MessageLabelAssignments = Record<string, string[]>;

type LabelEditorState = {
  mode: "create" | "edit";
  labelId: string | null;
  name: string;
  iconIndex: number;
};

type CategoryType = 
  | "all" 
  | "ops" 
  | "billing" 
  | "personal" 
  | "security" 
  | "marketing" 
  | "social" 
  | "support" 
  | "newsletters" 
  | "invoices" 
  | "receipts" 
  | "alerts" 
  | "system" 
  | "accounts" 
  | "payments" 
  | "shipping" 
  | "receipts" 
  | "confirmations" 
  | "notifications" 
  | "feedback" 
  | "reports" 
  | "meetings" 
  | "documents" 
  | "spam";

type DashboardSettings = {
  displayName: string;
  soundEnabled: boolean;
  syncLabelsEnabled: boolean;
  autoOpenFirstMessage: boolean;
  messagePageSize: 25 | 50 | 100;
  compactMessageRows: boolean;
  showMessagePreview: boolean;
  listDateMode: "absolute" | "relative";
  markAsReadOnOpen: boolean;
  defaultUnreadOnly: boolean;
  defaultDateRange: "all" | "7d" | "30d";
  defaultCategoryFilter: CategoryType;
  defaultStatusFilter: "all" | "read" | "unread" | "flagged";
  autoRefreshFolders: boolean;
  folderRefreshSeconds: 30 | 60 | 120 | 300;
  autoRefreshMessages: boolean;
  messageRefreshSeconds: 15 | 30 | 60 | 120;
  confirmBeforeDelete: boolean;
  confirmBeforeBulkActions: boolean;
  theme: "light" | "dark" | "auto";
  fontSize: "small" | "medium" | "large";
  fontFamily: "system" | "serif" | "monospace";
  keyboardShortcutsEnabled: boolean;
  replyFormat: "plain" | "html";
  emailSignature: string;
  spamFilterLevel: "off" | "low" | "medium" | "high";
  defaultReplyTo: string;
};

type SettingsTab = "general" | "notifications" | "labels" | "layout" | "messages" | "inbox" | "data" | "display" | "compose" | "safety";

const sidebarItems = [
  { label: "Inbox", icon: Inbox, fallback: "INBOX" },
  { label: "Starred", icon: Star, fallback: "__STARRED__" },
  { label: "Sent", icon: Send, fallback: "Sent" },
  { label: "Drafts", icon: LayoutPanelTop, fallback: "Drafts" },
  { label: "Trash", icon: Trash2, fallback: "Trash" },
  { label: "Spam", icon: ShieldAlert, fallback: "Junk" },
  { label: "Archive", icon: Archive, fallback: "Archive" },
  { label: "Labels", icon: Tags, fallback: "Archive" }
];

const sidebarWidthStorageKey = "citricloud-webmail.sidebar-width";
const listWidthStorageKey = "citricloud-webmail.list-width";
const bottomPaneHeightStorageKey = "citricloud-webmail.bottom-pane-height";
const readingPaneStorageKey = "citricloud-webmail.reading-pane";
const userLabelsStorageKeyPrefix = "citricloud-webmail.user-labels";
const messageLabelAssignmentsStorageKeyPrefix = "citricloud-webmail.message-label-assignments";
const dashboardSettingsStorageKeyPrefix = "citricloud-webmail.dashboard-settings";
const compactBreakpoint = 1024;

function hashString(str: string): number {
  let hash = 0;
  for (let index = 0; index < str.length; index += 1) {
    hash = (hash << 5) - hash + str.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

const LABEL_COLOR_PALETTE = [
  { iconClass: "text-rose-400", badgeClass: "border-rose-200 bg-rose-50 text-rose-700" },
  { iconClass: "text-amber-400", badgeClass: "border-amber-200 bg-amber-50 text-amber-700" },
  { iconClass: "text-emerald-400", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  { iconClass: "text-sky-400", badgeClass: "border-sky-200 bg-sky-50 text-sky-700" },
  { iconClass: "text-violet-400", badgeClass: "border-violet-200 bg-violet-50 text-violet-700" },
  { iconClass: "text-pink-400", badgeClass: "border-pink-200 bg-pink-50 text-pink-700" },
  { iconClass: "text-orange-400", badgeClass: "border-orange-200 bg-orange-50 text-orange-700" },
  { iconClass: "text-teal-400", badgeClass: "border-teal-200 bg-teal-50 text-teal-700" },
] as const;

const LABEL_ICONS = [
  Tag,
  Bookmark,
  Bell,
  Zap,
  Globe,
  Briefcase,
  Star,
  ShieldAlert,
  CalendarDays,
  Flag,
  Heart,
  Lightbulb,
  MapPin,
  Megaphone,
  Rocket,
  Archive
] as const;
const LABEL_ICON_NAMES = [
  "tag",
  "bookmark",
  "bell",
  "zap",
  "globe",
  "briefcase",
  "star",
  "shield",
  "calendar",
  "flag",
  "heart",
  "idea",
  "pin",
  "announce",
  "rocket",
  "archive"
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readStoredNumber(key: string, fallback: number, min: number, max: number) {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  const parsed = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(parsed) ? clamp(parsed, min, max) : fallback;
}

function readStoredPane() {
  if (typeof window === "undefined") {
    return "right" as const;
  }

  const value = window.localStorage.getItem(readingPaneStorageKey);
  if (value === "bottom") {
    return "bottom" as const;
  }
  if (value === "list") {
    return "list" as const;
  }
  return "right" as const;
}

function buildReplyBody(detail: MessageDetail): string {
  const timestamp = detail.date ? new Date(detail.date).toLocaleString() : "an earlier time";
  const originalBody = detail.text || "Original message content is not available in plain text.";
  const quotedBody = originalBody
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");

  return `\n\nOn ${timestamp}, ${detail.from} wrote:\n${quotedBody}`;
}

function buildMessageIframeDocument(html: string) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <base target="_blank" />
    <style>
      :root { color-scheme: light; }
      html, body {
        margin: 0;
        padding: 0;
        font-family: Inter, Arial, sans-serif;
        line-height: 1.5;
        color: #1f2937;
        background: #f8fafc;
      }
      body {
        padding: 16px;
        overflow-wrap: anywhere;
      }
      img, table {
        max-width: 100%;
      }
      pre {
        white-space: pre-wrap;
      }
    </style>
  </head>
  <body>${html}</body>
</html>`;
}

function formatAttachmentSize(bytes: number) {
  if (!bytes || bytes < 1024) {
    return `${bytes || 0} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function openAttachment(contentBase64: string, contentType: string, filename: string) {
  const binary = window.atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], { type: contentType });
  const url = URL.createObjectURL(blob);

  if (contentType.includes("pdf")) {
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

function playNotificationTone() {
  if (typeof window === "undefined") {
    return;
  }

  const audioContext = new window.AudioContext();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.24);
  oscillator.onended = () => {
    void audioContext.close();
  };
}

function resolveFolderPath(folders: MailFolder[], candidates: string[]) {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  const exactMatch = folders.find((folder) => normalizedCandidates.includes(folder.path.toLowerCase()) || normalizedCandidates.includes(folder.name.toLowerCase()));
  if (exactMatch) {
    return exactMatch.path;
  }

  const includesMatch = folders.find((folder) => normalizedCandidates.some((candidate) => folder.path.toLowerCase().includes(candidate) || folder.name.toLowerCase().includes(candidate)));
  return includesMatch?.path ?? null;
}

function toMessageKey(folder: string, uid: number) {
  return `${folder}::${uid}`;
}

function buildDefaultDisplayName(email: string) {
  const localPart = email.split("@")[0] ?? email;
  return localPart.replace(/[._-]+/g, " ").trim() || email;
}

function formatMessageListDate(dateValue: string | null | undefined, mode: "absolute" | "relative") {
  if (!dateValue) {
    return "Now";
  }

  const parsedDate = new Date(dateValue);
  if (Number.isNaN(parsedDate.getTime())) {
    return "Now";
  }

  if (mode === "absolute") {
    return parsedDate.toLocaleDateString();
  }

  const deltaMs = parsedDate.getTime() - Date.now();
  const absDeltaMs = Math.abs(deltaMs);
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;
  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absDeltaMs < hourMs) {
    return formatter.format(Math.round(deltaMs / minuteMs), "minute");
  }
  if (absDeltaMs < dayMs) {
    return formatter.format(Math.round(deltaMs / hourMs), "hour");
  }
  return formatter.format(Math.round(deltaMs / dayMs), "day");
}

function readDashboardSettings(storageKey: string, email: string): DashboardSettings {
  const fallback: DashboardSettings = {
    displayName: buildDefaultDisplayName(email),
    soundEnabled: true,
    syncLabelsEnabled: true,
    autoOpenFirstMessage: true,
    messagePageSize: 25,
    compactMessageRows: false,
    showMessagePreview: true,
    listDateMode: "absolute",
    markAsReadOnOpen: true,
    defaultUnreadOnly: false,
    defaultDateRange: "all",
    defaultCategoryFilter: "all",
    defaultStatusFilter: "all",
    autoRefreshFolders: true,
    folderRefreshSeconds: 60,
    autoRefreshMessages: true,
    messageRefreshSeconds: 30,
    confirmBeforeDelete: false,
    confirmBeforeBulkActions: false,
    theme: "auto",
    fontSize: "medium",
    fontFamily: "system",
    keyboardShortcutsEnabled: true,
    replyFormat: "html",
    emailSignature: "",
    spamFilterLevel: "medium",
    defaultReplyTo: ""
  };

  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<DashboardSettings>;
    const parsedPageSize = parsed.messagePageSize;
    const messagePageSize = parsedPageSize === 50 || parsedPageSize === 100 ? parsedPageSize : 25;
    const folderRefreshSeconds = parsed.folderRefreshSeconds === 30 || parsed.folderRefreshSeconds === 120 || parsed.folderRefreshSeconds === 300 ? parsed.folderRefreshSeconds : 60;
    const messageRefreshSeconds = parsed.messageRefreshSeconds === 15 || parsed.messageRefreshSeconds === 60 || parsed.messageRefreshSeconds === 120 ? parsed.messageRefreshSeconds : 30;
    const theme = parsed.theme === "dark" || parsed.theme === "light" || parsed.theme === "auto" ? parsed.theme : fallback.theme;
    const fontSize = parsed.fontSize === "small" || parsed.fontSize === "large" ? parsed.fontSize : fallback.fontSize;
    const fontFamily = parsed.fontFamily === "serif" || parsed.fontFamily === "monospace" ? parsed.fontFamily : fallback.fontFamily;
    const replyFormat = parsed.replyFormat === "plain" ? "plain" : fallback.replyFormat;
    const spamFilterLevel = parsed.spamFilterLevel === "off" || parsed.spamFilterLevel === "low" || parsed.spamFilterLevel === "high" ? parsed.spamFilterLevel : fallback.spamFilterLevel;
    return {
      displayName: typeof parsed.displayName === "string" && parsed.displayName.trim() ? parsed.displayName : fallback.displayName,
      soundEnabled: parsed.soundEnabled ?? fallback.soundEnabled,
      syncLabelsEnabled: parsed.syncLabelsEnabled ?? fallback.syncLabelsEnabled,
      autoOpenFirstMessage: parsed.autoOpenFirstMessage ?? fallback.autoOpenFirstMessage,
      messagePageSize,
      compactMessageRows: parsed.compactMessageRows ?? fallback.compactMessageRows,
      showMessagePreview: parsed.showMessagePreview ?? fallback.showMessagePreview,
      listDateMode: parsed.listDateMode === "relative" ? "relative" : fallback.listDateMode,
      markAsReadOnOpen: parsed.markAsReadOnOpen ?? fallback.markAsReadOnOpen,
      defaultUnreadOnly: parsed.defaultUnreadOnly ?? fallback.defaultUnreadOnly,
      defaultDateRange: parsed.defaultDateRange === "7d" || parsed.defaultDateRange === "30d" ? parsed.defaultDateRange : fallback.defaultDateRange,
      defaultCategoryFilter: isValidCategory(parsed.defaultCategoryFilter) ? parsed.defaultCategoryFilter : fallback.defaultCategoryFilter,
      defaultStatusFilter:
        parsed.defaultStatusFilter === "read" || parsed.defaultStatusFilter === "unread" || parsed.defaultStatusFilter === "flagged"
          ? parsed.defaultStatusFilter
          : fallback.defaultStatusFilter,
      autoRefreshFolders: parsed.autoRefreshFolders ?? fallback.autoRefreshFolders,
      folderRefreshSeconds,
      autoRefreshMessages: parsed.autoRefreshMessages ?? fallback.autoRefreshMessages,
      messageRefreshSeconds,
      confirmBeforeDelete: parsed.confirmBeforeDelete ?? fallback.confirmBeforeDelete,
      confirmBeforeBulkActions: parsed.confirmBeforeBulkActions ?? fallback.confirmBeforeBulkActions,
      theme,
      fontSize,
      fontFamily,
      keyboardShortcutsEnabled: parsed.keyboardShortcutsEnabled ?? fallback.keyboardShortcutsEnabled,
      replyFormat,
      emailSignature: typeof parsed.emailSignature === "string" ? parsed.emailSignature : fallback.emailSignature,
      spamFilterLevel,
      defaultReplyTo: typeof parsed.defaultReplyTo === "string" ? parsed.defaultReplyTo : fallback.defaultReplyTo
    };
  } catch {
    return fallback;
  }
}

function isValidCategory(value: unknown): value is CategoryType {
  const validCategories: CategoryType[] = [
    "all", "ops", "billing", "personal", "security", "marketing", "social", "support",
    "newsletters", "invoices", "receipts", "alerts", "system", "accounts", "payments",
    "shipping", "confirmations", "notifications", "feedback", "reports", "meetings",
    "documents", "spam"
  ];
  return validCategories.includes(value as CategoryType);
}

function getCategoryKeywords(): Record<Exclude<CategoryType, "all">, string[]> {
  return {
    ops: ["ops", "operation", "outage", "incident", "oncall", "deployment", "infra", "devops", "infrastructure"],
    billing: ["billing", "invoice", "payment", "receipt", "subscription", "charge", "card", "transaction"],
    personal: ["personal", "friend", "family", "hi there", "check this out", "let's chat", "how are you"],
    security: ["security", "auth", "phish", "breach", "vulnerability", "alert", "warning", "critical", "unauthorized", "verified"],
    marketing: ["marketing", "promotion", "sale", "offer", "discount", "deal", "special", "limited time", "save now"],
    social: ["social", "facebook", "twitter", "linkedin", "instagram", "notification", "tagged", "mentioned"],
    support: ["support", "help", "ticket", "issue", "problem", "error", "contact support", "customer service"],
    newsletters: ["newsletter", "weekly", "digest", "unsubscribe", "subscription", "magazine", "publication"],
    invoices: ["invoice", "bill", "statement", "due", "amount due", "order confirmation"],
    receipts: ["receipt", "purchase", "order", "confirmation", "receipt number", "amazon"],
    alerts: ["alert", "warning", "notification", "verify", "confirm", "action required", "unusual activity"],
    system: ["system", "server", "database", "backup", "maintenance", "update", "automatic", "cron"],
    accounts: ["account", "username", "password", "login", "verify email", "confirm identity"],
    payments: ["payment", "charge", "bill", "invoice", "refund", "credit", "debit"],
    shipping: ["shipping", "delivery", "tracking", "package", "order shipped", "shipped"],
    confirmations: ["confirm", "confirmation", "verify", "verified", "confirm email", "confirm account"],
    notifications: ["notification", "notify", "reminder", "alert", "update", "news"],
    feedback: ["feedback", "survey", "review", "rate us", "opinion", "testimonial"],
    reports: ["report", "analytics", "summary", "insights", "statistics", "monthly"],
    meetings: ["meeting", "calendar", "invite", "conference", "webinar", "zoom", "call"],
    documents: ["document", "attachment", "file", "pdf", "spreadsheet", "presentation"],
    spam: ["spam", "viagra", "casino", "lottery", "winner", "nigerian", "click here", "too good to be true"]
  };
}

export function MailDashboard({
  session,
  initialFolders,
  savedAccounts,
  onResumeAccount,
  onSignedOut,
  onAddAccount
}: MailDashboardProps) {
  const dashboardSettingsStorageKey = `${dashboardSettingsStorageKeyPrefix}.${session.email.toLowerCase()}`;
  const initialDashboardSettings = readDashboardSettings(dashboardSettingsStorageKey, session.email);
  const [activeFolder, setActiveFolder] = useState(initialFolders[0]?.path ?? "INBOX");
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [readingPane, setReadingPane] = useState<"right" | "bottom" | "list">(() => readStoredPane());
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(sidebarWidthStorageKey, 272, 240, 420));
  const [listWidth, setListWidth] = useState(() => readStoredNumber(listWidthStorageKey, 340, 280, 620));
  const [bottomPaneHeight, setBottomPaneHeight] = useState(() => readStoredNumber(bottomPaneHeightStorageKey, 320, 220, 640));
  const [resizeTarget, setResizeTarget] = useState<"sidebar" | "list" | "bottom" | null>(null);
  const [paneMenuOpen, setPaneMenuOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [filterUnread, setFilterUnread] = useState(initialDashboardSettings.defaultUnreadOnly);
  const [dateRange, setDateRange] = useState<"all" | "7d" | "30d">(initialDashboardSettings.defaultDateRange);
  const [categoryFilter, setCategoryFilter] = useState<CategoryType>(initialDashboardSettings.defaultCategoryFilter);
  const [statusFilter, setStatusFilter] = useState<"all" | "read" | "unread" | "flagged">(initialDashboardSettings.defaultStatusFilter);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [messageLabelAssignments, setMessageLabelAssignments] = useState<MessageLabelAssignments>({});
  const [labelEditor, setLabelEditor] = useState<LabelEditorState | null>(null);
  const [missingLabelsModalOpen, setMissingLabelsModalOpen] = useState(false);
  const [messageLimit, setMessageLimit] = useState<number>(initialDashboardSettings.messagePageSize);
  const [selectMenuOpen, setSelectMenuOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [composerDraft, setComposerDraft] = useState<ComposeDraft | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [settings, setSettings] = useState<DashboardSettings>(initialDashboardSettings);
  const [isSyncingLabels, setIsSyncingLabels] = useState(false);
  const [messageHeaderMenuOpen, setMessageHeaderMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: MessagePreview } | null>(null);
  const [selectedMessageSourceFolder, setSelectedMessageSourceFolder] = useState<string | null>(null);
  const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(new Set());
  const [dragMoveMode, setDragMoveMode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [activeAttachmentId, setActiveAttachmentId] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const contentGridRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const knownMessageKeysByFolderRef = useRef<Record<string, string[]>>({});
  const queryClient = useQueryClient();
  const userLabelsStorageKey = `${userLabelsStorageKeyPrefix}.${session.email.toLowerCase()}`;
  const messageLabelAssignmentsStorageKey = `${messageLabelAssignmentsStorageKeyPrefix}.${session.email.toLowerCase()}`;
  const displayName = settings.displayName.trim() || buildDefaultDisplayName(session.email);

  useEffect(() => {
    setMessageLimit(settings.messagePageSize);
  }, [settings.messagePageSize]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(dashboardSettingsStorageKey, JSON.stringify(settings));
  }, [settings, dashboardSettingsStorageKey]);

  const foldersQuery = useQuery({
    queryKey: ["folders", session.token],
    queryFn: () => getFolders(session.token),
    initialData: { folders: initialFolders },
    staleTime: 0,
    refetchInterval: settings.autoRefreshFolders ? settings.folderRefreshSeconds * 1000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", session.token, activeFolder, messageLimit],
    queryFn: () => getMessages(session.token, activeFolder, messageLimit),
    staleTime: 0,
    refetchInterval: settings.autoRefreshMessages ? settings.messageRefreshSeconds * 1000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const availableFolders = foldersQuery.data?.folders ?? initialFolders;
  const selectedPreview =
    (messagesQuery.data?.messages ?? []).find(
      (message) => message.uid === selectedUid && (!selectedMessageSourceFolder || message.folder === selectedMessageSourceFolder)
    ) ??
    (messagesQuery.data?.messages ?? []).find((message) => message.uid === selectedUid) ??
    null;
  const selectedMessageFolder = selectedMessageSourceFolder ?? selectedPreview?.folder ?? (activeFolder === "__STARRED__" ? "INBOX" : activeFolder);

  const selectedMessageQuery = useQuery({
    queryKey: ["message", session.token, selectedMessageFolder, selectedUid],
    queryFn: () => getMessage(session.token, selectedMessageFolder, selectedUid as number),
    enabled: selectedUid !== null,
    staleTime: 2 * 60 * 1000
  });

  const versionsQuery = useQuery<EnvironmentVersions>({
    queryKey: ["environment-versions"],
    queryFn: getEnvironmentVersions,
    staleTime: 5 * 60 * 1000
  });

  const deleteMutation = useMutation({
    mutationFn: ({ folder, uid }: { folder: string; uid: number }) => deleteMessageRequest(session.token, folder, uid),
    onSuccess: () => {
      messagesQuery.refetch();
      setSelectedUid(null);
      setSelectedMessageKeys(new Set());
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to delete message.");
    }
  });

  const moveMutation = useMutation({
    mutationFn: ({ folder, uid, destination }: { folder: string; uid: number; destination: string }) =>
      moveMessageRequest(session.token, folder, uid, destination),
    onSuccess: () => {
      messagesQuery.refetch();
      setSelectedUid(null);
      setSelectedMessageKeys(new Set());
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to move message.");
    }
  });

  const moveBatchMutation = useMutation({
    mutationFn: ({ items, destination }: { items: MoveBatchItem[]; destination: string }) =>
      moveMessagesBatchRequest(session.token, items, destination),
    onSuccess: () => {
      messagesQuery.refetch();
      setSelectedUid(null);
      setSelectedMessageKeys(new Set());
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to move selected messages.");
    }
  });

  const updateFlagsMutation = useMutation({
    mutationFn: (payload: { folder: string; uid: number; unread?: boolean; flagged?: boolean }) =>
      updateMessageFlagsRequest(session.token, payload),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["messages", session.token, activeFolder, messageLimit] });
      await queryClient.cancelQueries({ queryKey: ["message", session.token, selectedMessageFolder, selectedUid] });
      if (payload.flagged !== undefined && activeFolder !== "__STARRED__") {
        await queryClient.cancelQueries({ queryKey: ["messages", session.token, "__STARRED__", messageLimit] });
      }

      const previousMessages = queryClient.getQueryData<{ messages: MessagePreview[] }>(["messages", session.token, activeFolder, messageLimit]);
      const previousDetail = queryClient.getQueryData<{ message: MessageDetail }>(["message", session.token, selectedMessageFolder, selectedUid]);
      const previousStarred = payload.flagged !== undefined && activeFolder !== "__STARRED__" 
        ? queryClient.getQueryData<{ messages: MessagePreview[] }>(["messages", session.token, "__STARRED__", messageLimit])
        : undefined;

      queryClient.setQueryData<{ messages: MessagePreview[] }>(["messages", session.token, activeFolder, messageLimit], (current) => {
        if (!current) {
          return current;
        }

        // If unflagging in Starred folder, remove the message
        if (activeFolder === "__STARRED__" && payload.flagged === false) {
          return {
            ...current,
            messages: current.messages.filter((message) => !(message.uid === payload.uid && message.folder === payload.folder))
          };
        }

        return {
          ...current,
          messages: current.messages.map((message) => {
            if (message.uid !== payload.uid || message.folder !== payload.folder) {
              return message;
            }

            return {
              ...message,
              unread: payload.unread ?? message.unread,
              flagged: payload.flagged ?? message.flagged
            };
          })
        };
      });

      // If flagging a message, also add it to Starred folder cache
      if (payload.flagged === true && activeFolder !== "__STARRED__") {
        const sourceMessage = (previousMessages?.messages ?? []).find((m) => m.uid === payload.uid && m.folder === payload.folder);
        if (sourceMessage && previousStarred) {
          queryClient.setQueryData<{ messages: MessagePreview[] }>(["messages", session.token, "__STARRED__", messageLimit], (current) => {
            if (!current) {
              return current;
            }
            const isDuplicate = current.messages.some((m) => m.uid === payload.uid && m.folder === payload.folder);
            if (isDuplicate) {
              return current;
            }
            return {
              ...current,
              messages: [{ ...sourceMessage, flagged: true }, ...current.messages].slice(0, messageLimit)
            };
          });
        }
      }

      queryClient.setQueryData<{ message: MessageDetail }>(["message", session.token, selectedMessageFolder, selectedUid], (current) => {
        if (!current || current.message.uid !== payload.uid) {
          return current;
        }

        return {
          ...current,
          message: {
            ...current.message,
            unread: payload.unread ?? current.message.unread,
            flagged: payload.flagged ?? current.message.flagged
          }
        };
      });

      return { previousMessages, previousDetail, previousStarred };
    },
    onSuccess: (_data, payload) => {
      setActionError(null);
      if (payload.flagged !== undefined) {
        void queryClient.invalidateQueries({ queryKey: ["messages", session.token, "__STARRED__"] });
      }
    },
    onError: (error: Error, _variables, context) => {
      setActionError(error.message || "Unable to update message state.");
      if (context?.previousMessages) {
        queryClient.setQueryData(["messages", session.token, activeFolder, messageLimit], context.previousMessages);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(["message", session.token, selectedMessageFolder, selectedUid], context.previousDetail);
      }
      if (context?.previousStarred) {
        queryClient.setQueryData(["messages", session.token, "__STARRED__", messageLimit], context.previousStarred);
      }
    }
  });

  const sendMutation = useMutation({
    mutationFn: (payload: SendMessagePayload) => sendMessageRequest(session.token, payload),
    onSuccess: () => {
      setComposerDraft(null);
      messagesQuery.refetch();
    }
  });

  const saveDraftMutation = useMutation({
    mutationFn: (payload: DraftMessagePayload) => saveDraftMessageRequest(session.token, payload),
    onSuccess: () => {
      setDraftSavedAt(new Date().toLocaleTimeString());
      setActionError(null);
      foldersQuery.refetch();
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to save draft.");
    }
  });

  const createFolderMutation = useMutation({
    mutationFn: (folder: string) => createFolderRequest(session.token, folder),
    onSuccess: () => {
      foldersQuery.refetch();
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to create folder.");
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (folder: string) => deleteFolderRequest(session.token, folder),
    onSuccess: () => {
      foldersQuery.refetch();
      messagesQuery.refetch();
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to delete folder.");
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
    if (readingPane === "list" || !settings.autoOpenFirstMessage) {
      return;
    }

    if (messagesQuery.data?.messages.length && selectedUid === null) {
      const firstMessage = messagesQuery.data.messages[0];
      setSelectedUid(firstMessage.uid);
      setSelectedMessageSourceFolder(firstMessage.folder);
    }
  }, [messagesQuery.data, readingPane, selectedUid, settings.autoOpenFirstMessage]);

  useEffect(() => {
    if (!selectedPreview) {
      return;
    }

    setSelectedMessageSourceFolder(selectedPreview.folder);
  }, [selectedPreview]);

  useEffect(() => {
    if (!settings.markAsReadOnOpen || !selectedUid || !selectedMessageQuery.data?.message.unread) {
      return;
    }

    updateMessageState({
      folder: selectedMessageFolder,
      uid: selectedUid,
      unread: false
    });
  }, [selectedMessageFolder, selectedMessageQuery.data?.message.unread, selectedUid, settings.markAsReadOnOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(readingPaneStorageKey, readingPane);
  }, [readingPane]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(listWidthStorageKey, String(listWidth));
  }, [listWidth]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(bottomPaneHeightStorageKey, String(bottomPaneHeight));
  }, [bottomPaneHeight]);

  useEffect(() => {
    setSelectedMessageKeys(new Set());
    setDragMoveMode(false);
    setSelectionMode(false);
    setSelectMenuOpen(false);
    setMessageLimit(settings.messagePageSize);
    setIsLoadingMore(false);
  }, [activeFolder, settings.messagePageSize]);

  useEffect(() => {
    const nextSettings = readDashboardSettings(dashboardSettingsStorageKey, session.email);
    setSettings(nextSettings);
    setFilterUnread(nextSettings.defaultUnreadOnly);
    setDateRange(nextSettings.defaultDateRange);
    setCategoryFilter(nextSettings.defaultCategoryFilter);
    setStatusFilter(nextSettings.defaultStatusFilter);
    setMessageLimit(nextSettings.messagePageSize);
  }, [dashboardSettingsStorageKey, session.email]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(dashboardSettingsStorageKey, JSON.stringify(settings));
  }, [dashboardSettingsStorageKey, settings]);

  useEffect(() => {
    if (!selectedMessageKeys.size) {
      setDragMoveMode(false);
    }
  }, [selectedMessageKeys]);

  useEffect(() => {
    if (!messagesQuery.isFetching) {
      setIsLoadingMore(false);
    }
  }, [messagesQuery.isFetching]);

  useEffect(() => {
    const currentMessages = messagesQuery.data?.messages ?? [];
    const currentKeys = currentMessages.map((message) => toMessageKey(message.folder, message.uid));
    const previousKeys = knownMessageKeysByFolderRef.current[activeFolder] ?? [];

    if (previousKeys.length && currentKeys.length) {
      const previousFirst = previousKeys[0];
      const currentFirst = currentKeys[0];
      if (previousFirst !== currentFirst && settings.soundEnabled) {
        playNotificationTone();
      }
    }

    knownMessageKeysByFolderRef.current[activeFolder] = currentKeys;
  }, [activeFolder, messagesQuery.data?.messages, settings.soundEnabled]);

  useEffect(() => {
    if (!resizeTarget) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (resizeTarget === "sidebar" && gridRef.current) {
        const bounds = gridRef.current.getBoundingClientRect();
        setSidebarWidth(clamp(event.clientX - bounds.left, 240, 420));
      }

      if (resizeTarget === "list" && contentGridRef.current && readingPane === "right") {
        const bounds = contentGridRef.current.getBoundingClientRect();
        setListWidth(clamp(event.clientX - bounds.left, 280, 620));
      }

      if (resizeTarget === "bottom" && contentGridRef.current && readingPane === "bottom") {
        const bounds = contentGridRef.current.getBoundingClientRect();
        setBottomPaneHeight(clamp(event.clientY - bounds.top, 220, 640));
      }
    };

    const handleMouseUp = () => {
      setResizeTarget(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [readingPane, resizeTarget]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateViewportMode = () => {
      setIsCompactViewport(window.innerWidth < compactBreakpoint);
    };

    updateViewportMode();
    window.addEventListener("resize", updateViewportMode);

    return () => {
      window.removeEventListener("resize", updateViewportMode);
    };
  }, []);

  useEffect(() => {
    if (selectedUid === null || !messagesQuery.data?.messages) {
      return;
    }

    const stillExists = messagesQuery.data.messages.some(
      (message) =>
        message.uid === selectedUid &&
        (!selectedMessageSourceFolder || message.folder === selectedMessageSourceFolder)
    );
    if (!stillExists) {
      const firstMessage = messagesQuery.data.messages[0];
      setSelectedUid(firstMessage?.uid ?? null);
      setSelectedMessageSourceFolder(firstMessage?.folder ?? null);
    }
  }, [messagesQuery.data?.messages, selectedMessageSourceFolder, selectedUid]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const labelsRaw = window.localStorage.getItem(userLabelsStorageKey);
    if (labelsRaw) {
      try {
        const parsed = JSON.parse(labelsRaw) as UserLabel[];
        if (Array.isArray(parsed)) {
          setUserLabels(parsed);
        }
      } catch {
        setUserLabels([]);
      }
    } else {
      setUserLabels([]);
    }

    const assignmentsRaw = window.localStorage.getItem(messageLabelAssignmentsStorageKey);
    if (assignmentsRaw) {
      try {
        const parsed = JSON.parse(assignmentsRaw) as MessageLabelAssignments;
        if (parsed && typeof parsed === "object") {
          setMessageLabelAssignments(parsed);
        }
      } catch {
        setMessageLabelAssignments({});
      }
    } else {
      setMessageLabelAssignments({});
    }
  }, [messageLabelAssignmentsStorageKey, userLabelsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(userLabelsStorageKey, JSON.stringify(userLabels));
  }, [userLabels, userLabelsStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(messageLabelAssignmentsStorageKey, JSON.stringify(messageLabelAssignments));
  }, [messageLabelAssignments, messageLabelAssignmentsStorageKey]);

  useEffect(() => {
    if (selectedLabelId && !userLabels.some((label) => label.id === selectedLabelId)) {
      setSelectedLabelId(null);
    }
  }, [selectedLabelId, userLabels]);

  const customImapFolders = useMemo(() => {
    const systemFolderNames = ["inbox", "sent", "draft", "trash", "junk", "spam", "archive", "starred"];

    return availableFolders.filter((folder) => {
      const lower = folder.name.toLowerCase();
      const hasSystemName = systemFolderNames.some((name) => lower.includes(name));
      return !hasSystemName && !folder.specialUse;
    });
  }, [availableFolders]);

  const normalizedCustomFolderNames = useMemo(() => {
    return new Set(customImapFolders.map((folder) => folder.name.trim().toLowerCase()));
  }, [customImapFolders]);

  const normalizedLabelNames = useMemo(() => {
    return new Set(userLabels.map((label) => label.name.trim().toLowerCase()));
  }, [userLabels]);

  const labelsMissingFolderCount = useMemo(() => {
    return userLabels.filter((label) => !normalizedCustomFolderNames.has(label.name.trim().toLowerCase())).length;
  }, [normalizedCustomFolderNames, userLabels]);

  const foldersMissingLabelCount = useMemo(() => {
    return customImapFolders.filter((folder) => !normalizedLabelNames.has(folder.name.trim().toLowerCase())).length;
  }, [customImapFolders, normalizedLabelNames]);

  const syncLabelsWithImapFolders = async () => {
    if (isSyncingLabels) {
      return;
    }

    setIsSyncingLabels(true);

    try {
      const missingLabelFolders = customImapFolders.filter((folder) => !normalizedLabelNames.has(folder.name.trim().toLowerCase()));

      if (missingLabelFolders.length) {
        setUserLabels((current) => {
          const existingNames = new Set(current.map((label) => label.name.trim().toLowerCase()));
          const additions: UserLabel[] = [];

          for (const folder of missingLabelFolders) {
            const normalizedName = folder.name.trim().toLowerCase();
            if (existingNames.has(normalizedName)) {
              continue;
            }

            const hash = hashString(folder.name);
            additions.push({
              id: `${Date.now()}-${hash}-${normalizedName}`,
              name: folder.name,
              colorIndex: hash % LABEL_COLOR_PALETTE.length,
              iconIndex: hash % LABEL_ICONS.length
            });
            existingNames.add(normalizedName);
          }

          return additions.length ? [...current, ...additions] : current;
        });
      }

      const missingFolderLabels = userLabels.filter((label) => !normalizedCustomFolderNames.has(label.name.trim().toLowerCase()));

      for (const label of missingFolderLabels) {
        await createFolderRequest(session.token, label.name);
      }

      if (missingFolderLabels.length) {
        await foldersQuery.refetch();
      }

      setActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to synchronize labels.";
      setActionError(message);
    } finally {
      setIsSyncingLabels(false);
    }
  };

  useEffect(() => {
    if (!settings.syncLabelsEnabled) {
      return;
    }

    void syncLabelsWithImapFolders();
  }, [settings.syncLabelsEnabled, customImapFolders, userLabels]);

  const userLabelMap = useMemo(() => {
    return new Map(userLabels.map((label) => [label.id, label]));
  }, [userLabels]);

  const getMessageLabelIds = (message: MessagePreview) => {
    return messageLabelAssignments[toMessageKey(message.folder, message.uid)] ?? [];
  };

  const createUserLabel = (name: string): UserLabel => {
    const trimmed = name.trim();
    const existing = userLabels.find((label) => label.name.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      return existing;
    }

    const hash = hashString(trimmed);
    const newLabel: UserLabel = {
      id: `${Date.now()}-${hash}`,
      name: trimmed,
      colorIndex: hash % LABEL_COLOR_PALETTE.length,
      iconIndex: hash % LABEL_ICONS.length
    };

    setUserLabels((current) => [...current, newLabel]);
    return newLabel;
  };

  const openCreateUserLabelEditor = (defaultName = "") => {
    const hash = hashString(defaultName || String(Date.now()));
    setLabelEditor({
      mode: "create",
      labelId: null,
      name: defaultName,
      iconIndex: hash % LABEL_ICONS.length
    });
    setLabelsOpen(true);
  };

  const openEditUserLabelEditor = (labelId: string) => {
    const label = userLabels.find((item) => item.id === labelId);
    if (!label) {
      return;
    }

    setLabelEditor({
      mode: "edit",
      labelId,
      name: label.name,
      iconIndex: label.iconIndex
    });
  };

  const saveLabelEditor = () => {
    if (!labelEditor) {
      return;
    }

    const nextName = labelEditor.name.trim();
    if (!nextName) {
      setActionError("Label name is required.");
      return;
    }

    if (labelEditor.mode === "create") {
      const existing = userLabels.find((label) => label.name.toLowerCase() === nextName.toLowerCase());
      if (existing) {
        setSelectedLabelId(existing.id);
        setLabelEditor(null);
        setActionError(null);
        return;
      }

      const hash = hashString(nextName);
      const newLabel: UserLabel = {
        id: `${Date.now()}-${hash}`,
        name: nextName,
        colorIndex: hash % LABEL_COLOR_PALETTE.length,
        iconIndex: labelEditor.iconIndex % LABEL_ICONS.length
      };
      setUserLabels((current) => [...current, newLabel]);
      setSelectedLabelId(newLabel.id);
      setLabelEditor(null);
      setActionError(null);
      return;
    }

    setUserLabels((current) =>
      current.map((item) =>
        item.id === labelEditor.labelId
          ? {
              ...item,
              name: nextName,
              iconIndex: labelEditor.iconIndex % LABEL_ICONS.length,
              colorIndex: hashString(nextName) % LABEL_COLOR_PALETTE.length
            }
          : item
      )
    );
    setLabelEditor(null);
    setActionError(null);
  };

  const deleteUserLabel = (labelId: string) => {
    const label = userLabels.find((item) => item.id === labelId);
    if (!label) {
      return;
    }

    const confirmed = window.confirm(`Delete label "${label.name}"?`);
    if (!confirmed) {
      return;
    }

    setUserLabels((current) => current.filter((item) => item.id !== labelId));
    setMessageLabelAssignments((current) => {
      const next: MessageLabelAssignments = {};
      for (const [messageKey, labelIds] of Object.entries(current)) {
        const filteredIds = labelIds.filter((item) => item !== labelId);
        if (filteredIds.length) {
          next[messageKey] = filteredIds;
        }
      }
      return next;
    });

    setSelectedLabelId((current) => (current === labelId ? null : current));
  };

  const assignLabelToMessages = (messages: MessagePreview[], labelId: string) => {
    if (!messages.length) {
      return;
    }

    setMessageLabelAssignments((current) => {
      const next = { ...current };
      for (const message of messages) {
        const key = toMessageKey(message.folder, message.uid);
        const currentLabels = next[key] ?? [];
        if (!currentLabels.includes(labelId)) {
          next[key] = [...currentLabels, labelId];
        }
      }
      return next;
    });
  };

  const removeLabelsFromMessage = (message: MessagePreview) => {
    const key = toMessageKey(message.folder, message.uid);
    setMessageLabelAssignments((current) => {
      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const promptAssignLabelToMessages = (messages: MessagePreview[]) => {
    if (!messages.length) {
      return;
    }

    const existingNames = userLabels.map((label) => label.name).join(", ");
    const input = window
      .prompt(existingNames ? `Label name (existing: ${existingNames})` : "Label name", userLabels[0]?.name ?? "")
      ?.trim();

    if (!input) {
      return;
    }

    const label = createUserLabel(input);
    assignLabelToMessages(messages, label.id);
  };

  const labelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (messagesQuery.data?.messages ?? []).forEach((message) => {
      const ids = getMessageLabelIds(message);
      ids.forEach((id) => {
        counts[id] = (counts[id] ?? 0) + 1;
      });
    });
    return counts;
  }, [messageLabelAssignments, messagesQuery.data?.messages]);

  const filteredMessages = useMemo(() => {
    const now = Date.now();
    const categoryKeywords = getCategoryKeywords();

    return (messagesQuery.data?.messages ?? []).filter((message) => {
      if (filterUnread && !message.unread) {
        return false;
      }

      if (statusFilter === "read" && message.unread) {
        return false;
      }

      if (statusFilter === "unread" && !message.unread) {
        return false;
      }

      if (statusFilter === "flagged" && !message.flagged) {
        return false;
      }

      if (selectedLabelId && !getMessageLabelIds(message).includes(selectedLabelId)) {
        return false;
      }

      if (dateRange !== "all") {
        if (!message.date) {
          return false;
        }

        const messageDate = new Date(message.date).getTime();
        const ageMs = now - messageDate;

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
  }, [categoryFilter, dateRange, filterUnread, messageLabelAssignments, messagesQuery.data?.messages, searchText, selectedLabelId, statusFilter]);

  const detail = selectedMessageQuery.data?.message;
  const switchableAccounts = savedAccounts.filter((account) => account.session.token !== session.token);
  const inboxFolderPath =
    availableFolders.find((folder) => folder.specialUse === "\\Inbox")?.path ?? resolveFolderPath(availableFolders, ["inbox"]);
  const draftsFolderPath =
    availableFolders.find((folder) => folder.specialUse === "\\Drafts")?.path ?? resolveFolderPath(availableFolders, ["drafts"]);
  const archiveFolderPath =
    availableFolders.find((folder) => folder.specialUse === "\\Archive" || folder.specialUse === "\\All")?.path ??
    resolveFolderPath(availableFolders, ["archive", "all mail"]);
  const spamFolderPath =
    availableFolders.find((folder) => folder.specialUse === "\\Junk")?.path ?? resolveFolderPath(availableFolders, ["junk", "spam"]);
  const trashFolderPath =
    availableFolders.find((folder) => folder.specialUse === "\\Trash")?.path ?? resolveFolderPath(availableFolders, ["trash", "deleted"]);

  const resolveActionFolder = (uid: number | null, preferredFolder?: string | null) => {
    if (preferredFolder && preferredFolder !== "__STARRED__") {
      return preferredFolder;
    }

    if (uid !== null) {
      const sourceMessage = (messagesQuery.data?.messages ?? []).find((message) => message.uid === uid);
      if (sourceMessage?.folder && sourceMessage.folder !== "__STARRED__") {
        return sourceMessage.folder;
      }
    }

    if (selectedMessageSourceFolder && selectedMessageSourceFolder !== "__STARRED__") {
      return selectedMessageSourceFolder;
    }

    return activeFolder === "__STARRED__" ? "INBOX" : activeFolder;
  };

  const selectedMessages = useMemo(() => {
    const currentMessages = messagesQuery.data?.messages ?? [];
    return currentMessages.filter((message) => selectedMessageKeys.has(toMessageKey(message.folder, message.uid)));
  }, [messagesQuery.data?.messages, selectedMessageKeys]);

  const activeSelectedMessages = selectedMessages.length ? selectedMessages : selectedPreview ? [selectedPreview] : [];

  const activeSidebarLabel = useMemo(() => {
    if (selectedLabelId) {
      return "Labels";
    }

    if (activeFolder === "__STARRED__") {
      return "Starred";
    }

    const matchedFolder = availableFolders.find((folder) => folder.path === activeFolder);
    switch (matchedFolder?.specialUse) {
      case "\\Inbox":
        return "Inbox";
      case "\\Sent":
        return "Sent";
      case "\\Drafts":
        return "Drafts";
      case "\\Trash":
        return "Trash";
      case "\\Junk":
        return "Spam";
      case "\\Archive":
      case "\\All":
        return "Archive";
      default:
        break;
    }

    if (spamFolderPath && activeFolder === spamFolderPath) {
      return "Spam";
    }

    if (archiveFolderPath && activeFolder === archiveFolderPath) {
      return "Archive";
    }

    if (inboxFolderPath && activeFolder === inboxFolderPath) {
      return "Inbox";
    }

    const matched = sidebarItems.find((item) => item.fallback !== "__STARRED__" && activeFolder === item.fallback);
    return matched?.label ?? null;
  }, [activeFolder, archiveFolderPath, availableFolders, inboxFolderPath, selectedLabelId, spamFolderPath]);

  const activeFolderTitle = useMemo(() => {
    if (selectedLabelId) {
      const selectedLabel = userLabels.find((label) => label.id === selectedLabelId);
      if (selectedLabel) {
        return `Label: ${selectedLabel.name}`;
      }
    }

    if (activeFolder === "__STARRED__") {
      return "Starred";
    }

    const matched = availableFolders.find((folder) => folder.path === activeFolder);
    return matched?.name ?? activeFolder;
  }, [activeFolder, availableFolders, selectedLabelId, userLabels]);

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

  const openForwardComposer = () => {
    if (!detail) {
      return;
    }

    const forwardSubject = detail.subject.startsWith("Fwd:") ? detail.subject : `Fwd: ${detail.subject}`;
    const forwardBody = `\n\n---------- Forwarded message ---------\nFrom: ${detail.from}\nDate: ${detail.date ? new Date(detail.date).toLocaleString() : "Unknown"}\nSubject: ${detail.subject}\nTo: ${detail.to}\n${detail.cc ? `Cc: ${detail.cc}\n` : ""}\n\n${detail.text || detail.html || ""}`;

    setComposerDraft({
      mode: "compose",
      to: "",
      cc: "",
      bcc: "",
      subject: forwardSubject,
      body: forwardBody
    });
  };

  const promptCreateFolder = (defaultName = "") => {
    const folderName = window.prompt("Enter folder name", defaultName)?.trim();
    if (!folderName) {
      return;
    }

    createFolderMutation.mutate(folderName);
  };

  const runFolderSync = () => {
    foldersQuery.refetch();
    messagesQuery.refetch();
  };

  const runMessagesSync = () => {
    messagesQuery.refetch();
  };

  const startSelectionMode = () => {
    setSelectionMode(true);
    setSelectedMessageKeys(new Set());
    setSelectMenuOpen(false);
  };

  const selectAllVisibleMessages = () => {
    setSelectionMode(true);
    setSelectedMessageKeys(new Set(filteredMessages.map((message) => toMessageKey(message.folder, message.uid))));
    setSelectMenuOpen(false);
  };

  const turnSelectionModeOff = () => {
    setSelectionMode(false);
    setSelectedMessageKeys(new Set());
    setDragMoveMode(false);
    setSelectMenuOpen(false);
  };

  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    const distanceFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
    const loadedMessageCount = messagesQuery.data?.messages.length ?? 0;
    const canLoadMore = loadedMessageCount >= messageLimit;

    if (distanceFromBottom < 80 && canLoadMore && !messagesQuery.isFetching && !isLoadingMore) {
      setIsLoadingMore(true);
      setMessageLimit((current) => current + settings.messagePageSize);
    }
  };

  const toggleMessageSelection = (message: MessagePreview) => {
    const key = toMessageKey(message.folder, message.uid);
    setSelectedMessageKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const resolveMoveDestination = (target: "inbox" | "starred" | "trash" | "spam" | "archive") => {
    if (target === "inbox") {
      return inboxFolderPath;
    }
    if (target === "trash") {
      return trashFolderPath;
    }
    if (target === "spam") {
      return spamFolderPath;
    }
    if (target === "archive") {
      return archiveFolderPath;
    }
    return null;
  };

  const moveSelectedMessages = async (target: "inbox" | "starred" | "trash" | "spam" | "archive") => {
    if (!activeSelectedMessages.length) {
      return;
    }

    if (settings.confirmBeforeBulkActions) {
      const operationLabel = target === "starred" ? "flag" : `move to ${target}`;
      if (!window.confirm(`Apply bulk action to ${activeSelectedMessages.length} messages: ${operationLabel}?`)) {
        return;
      }
    }

    if (target === "starred") {
      await Promise.all(
        activeSelectedMessages.map((message) => updateFlagsMutation.mutateAsync({ folder: message.folder, uid: message.uid, flagged: true }))
      );
      setSelectedMessageKeys(new Set());
      return;
    }

    const destination = resolveMoveDestination(target);
    if (!destination) {
      setActionError("Destination folder is unavailable.");
      return;
    }

    const items = activeSelectedMessages.map((message) => ({ folder: message.folder, uid: message.uid }));
    await moveBatchMutation.mutateAsync({ items, destination });
    setDragMoveMode(false);
  };

  const deleteSelectedMessages = async () => {
    if (!activeSelectedMessages.length) {
      return;
    }

    if (settings.confirmBeforeDelete) {
      if (!window.confirm(`Delete ${activeSelectedMessages.length} selected messages?`)) {
        return;
      }
    }

    if (trashFolderPath) {
      const items = selectedMessages
        .filter((message) => message.folder !== trashFolderPath)
        .map((message) => ({ folder: message.folder, uid: message.uid }));

      if (items.length) {
        await moveBatchMutation.mutateAsync({ items, destination: trashFolderPath });
        return;
      }
    }

    await Promise.all(activeSelectedMessages.map((message) => deleteMutation.mutateAsync({ folder: message.folder, uid: message.uid })));
    setSelectedMessageKeys(new Set());
  };

  const saveDraft = (payload: Omit<DraftMessagePayload, "folder">) => {
    if (!draftsFolderPath) {
      setActionError("Drafts folder is unavailable.");
      return;
    }

    saveDraftMutation.mutate({
      folder: draftsFolderPath,
      ...payload
    });
  };

  const startDragMove = (message: MessagePreview) => {
    const key = toMessageKey(message.folder, message.uid);
    setSelectedMessageKeys((current) => {
      if (current.has(key)) {
        return new Set(current);
      }

      const next = new Set(current);
      next.add(key);
      return next;
    });
    setDragMoveMode(true);
    setContextMenu(null);
  };

  const dropSelectedToFolder = async (destination: string | null) => {
    if (!destination || !activeSelectedMessages.length) {
      return;
    }

    await moveBatchMutation.mutateAsync({
      items: activeSelectedMessages.map((message) => ({ folder: message.folder, uid: message.uid })),
      destination
    });
    setDragMoveMode(false);
  };

  const moveSelectedMessage = (destination: string | null, override?: { folder: string; uid: number }) => {
    const targetUid = override?.uid ?? selectedUid;
    const sourceFolder = resolveActionFolder(targetUid, override?.folder ?? selectedMessageFolder);

    if (!targetUid || !destination) {
      return;
    }

    moveMutation.mutate({
      folder: sourceFolder,
      uid: targetUid,
      destination
    });
    setContextMenu(null);
  };

  const deleteSelectedMessage = (override?: { folder: string; uid: number }) => {
    const targetUid = override?.uid ?? selectedUid;
    const sourceFolder = resolveActionFolder(targetUid, override?.folder ?? selectedMessageFolder);

    if (!targetUid) {
      return;
    }

    if (settings.confirmBeforeDelete) {
      if (!window.confirm("Delete this message?")) {
        return;
      }
    }

    if (trashFolderPath && sourceFolder !== trashFolderPath) {
      moveSelectedMessage(trashFolderPath, { folder: sourceFolder, uid: targetUid });
      return;
    }

    deleteMutation.mutate({ folder: sourceFolder, uid: targetUid });
    setContextMenu(null);
  };

  const updateMessageState = (payload: { folder: string; uid: number; unread?: boolean; flagged?: boolean }) => {
    updateFlagsMutation.mutate({
      ...payload,
      folder: resolveActionFolder(payload.uid, payload.folder)
    });
    setContextMenu(null);
  };

  const isMessageSelected = (message: MessagePreview) => {
    if (selectedUid !== message.uid) {
      return false;
    }

    if (selectedMessageSourceFolder) {
      return selectedMessageSourceFolder === message.folder;
    }

    return true;
  };

  const prefetchMessageDetail = (message: MessagePreview) => {
    void queryClient.prefetchQuery({
      queryKey: ["message", session.token, message.folder, message.uid],
      queryFn: () => getMessage(session.token, message.folder, message.uid),
      staleTime: 2 * 60 * 1000
    });
  };

  const openMessageAttachment = async (attachment: MessageAttachment) => {
    const cachedContent = attachment.contentBase64;
    if (cachedContent) {
      openAttachment(cachedContent, attachment.contentType, attachment.filename);
      return;
    }

    if (selectedUid === null) {
      return;
    }

    try {
      setActiveAttachmentId(attachment.id);
      const response = await getMessageAttachmentContent(session.token, selectedMessageFolder, selectedUid, attachment.id);
      const fetched = response.attachment;

      queryClient.setQueryData<{ message: MessageDetail }>(["message", session.token, selectedMessageFolder, selectedUid], (current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          message: {
            ...current.message,
            attachments: current.message.attachments.map((item) =>
              item.id === fetched.id ? { ...item, contentBase64: fetched.contentBase64 } : item
            )
          }
        };
      });

      openAttachment(fetched.contentBase64, fetched.contentType, fetched.filename);
      setActionError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to load attachment.";
      setActionError(message);
    } finally {
      setActiveAttachmentId((current) => (current === attachment.id ? null : current));
    }
  };

  const isRightPane = readingPane === "right";
  const isListPane = readingPane === "list";
  const allowDesktopResize = !isCompactViewport;

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
          <div className="relative">
            <button
              className="inline-flex items-center rounded-2xl border border-brand-200 bg-white p-2.5 text-brand-700"
              title={readingPane === "right" ? "Right pane view" : readingPane === "bottom" ? "Bottom pane view" : "List view"}
              type="button"
              onClick={() => setPaneMenuOpen((current) => !current)}
            >
              {readingPane === "right" ? <PanelRight className="h-4 w-4" /> : readingPane === "bottom" ? <PanelBottom className="h-4 w-4" /> : <LayoutPanelTop className="h-4 w-4" />}
            </button>

            {paneMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-44 rounded-2xl border border-surface-200 bg-white p-2 shadow-panel">
                <button
                  className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  type="button"
                  onClick={() => {
                    setReadingPane("right");
                    setPaneMenuOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <PanelRight className="h-4 w-4 text-brand-600" /> Right view
                  </span>
                  {readingPane === "right" ? <Check className="h-4 w-4 text-brand-600" /> : null}
                </button>
                <button
                  className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  type="button"
                  onClick={() => {
                    setReadingPane("bottom");
                    setPaneMenuOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <PanelBottom className="h-4 w-4 text-brand-600" /> Bottom view
                  </span>
                  {readingPane === "bottom" ? <Check className="h-4 w-4 text-brand-600" /> : null}
                </button>
                <button
                  className="mt-1 flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-surface-700 hover:bg-surface-50"
                  type="button"
                  onClick={() => {
                    setReadingPane("list");
                    setPaneMenuOpen(false);
                  }}
                >
                  <span className="inline-flex items-center gap-2">
                    <LayoutPanelTop className="h-4 w-4 text-brand-600" /> List view
                  </span>
                  {readingPane === "list" ? <Check className="h-4 w-4 text-brand-600" /> : null}
                </button>
              </div>
            ) : null}
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500" type="button" onClick={openNewComposer}>
            New Message
          </button>
          <button
            className="inline-flex items-center rounded-2xl border border-surface-200 bg-white p-2.5 text-surface-700 hover:bg-surface-50"
            title="Settings"
            type="button"
            onClick={() => {
              setAccountMenuOpen(false);
              setSettingsTab("general");
              setSettingsOpen(true);
            }}
          >
            <Cog className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              className="inline-flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700"
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
            >
              <UserCircle2 className="h-5 w-5 text-brand-600" />
              {displayName}
              <ChevronDown className="h-4 w-4" />
            </button>

            {accountMenuOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-80 rounded-3xl border border-surface-200 bg-white p-3 shadow-panel">
                <div className="border-b border-surface-200 px-3 pb-3">
                  <p className="text-sm font-semibold text-surface-900">{displayName}</p>
                  <p className="text-xs text-surface-500">{session.email}</p>
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

      <div
        ref={gridRef}
        className="grid min-h-0"
        style={allowDesktopResize ? { gridTemplateColumns: `${sidebarWidth}px minmax(0,1fr)` } : { gridTemplateColumns: "minmax(0,1fr)" }}
      >
        <aside className={`relative flex min-h-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#0b2141,#14345f)] p-5 text-white hide-scrollbar ${allowDesktopResize ? "border-r border-surface-200" : "border-b border-surface-200"}`}>
          <div className="mb-4 border-b border-white/20 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100">Connected environment</p>
            <p className="mt-2 text-base font-semibold">{session.presetKey}</p>
            <p className="text-xs text-brand-100">{displayName}</p>
            <p className="text-[11px] text-brand-100/80">{session.email}</p>
          </div>

          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const LucideIcon = item.icon;
              const matchingFolder = availableFolders.find((folder) =>
                folder.path.toLowerCase().includes(item.fallback.toLowerCase()) || folder.name.toLowerCase() === item.label.toLowerCase()
              );
              const specialUseFolder =
                item.label === "Inbox"
                  ? availableFolders.find((folder) => folder.specialUse === "\\Inbox")
                  : item.label === "Sent"
                    ? availableFolders.find((folder) => folder.specialUse === "\\Sent")
                    : item.label === "Drafts"
                      ? availableFolders.find((folder) => folder.specialUse === "\\Drafts")
                      : item.label === "Trash"
                        ? availableFolders.find((folder) => folder.specialUse === "\\Trash")
                        : item.label === "Spam"
                          ? availableFolders.find((folder) => folder.specialUse === "\\Junk")
                          : item.label === "Archive"
                            ? availableFolders.find((folder) => folder.specialUse === "\\Archive" || folder.specialUse === "\\All")
                            : null;
              const targetFolder =
                item.label === "Labels"
                  ? null
                  : item.label === "Archive"
                    ? archiveFolderPath ?? specialUseFolder?.path ?? matchingFolder?.path ?? item.fallback
                    : item.label === "Spam"
                      ? spamFolderPath ?? specialUseFolder?.path ?? matchingFolder?.path ?? item.fallback
                    : item.label === "Starred"
                      ? "__STARRED__"
                      : specialUseFolder?.path ?? matchingFolder?.path ?? item.fallback;

              return (
                <button
                  key={item.label}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                    activeSidebarLabel === item.label ? "bg-white text-brand-700" : "bg-white/5 text-white/80 hover:bg-white/10"
                  }`}
                  type="button"
                  onClick={() => {
                    if (item.label === "Labels") {
                      const nextState = !labelsOpen;
                      setLabelsOpen(nextState);
                      if (!nextState) {
                        setSelectedLabelId(null);
                      }
                      return;
                    }
                    if (targetFolder) {
                      setActiveFolder(targetFolder);
                    }
                    setSelectedLabelId(null);
                    setLabelsOpen(false);
                    setSelectedUid(null);
                    setSelectedMessageSourceFolder(null);
                  }}
                  onDragOver={(event) => {
                    if (!dragMoveMode || !targetFolder) {
                      return;
                    }
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    if (!dragMoveMode || !targetFolder || item.label === "Starred") {
                      return;
                    }
                    event.preventDefault();
                    void dropSelectedToFolder(targetFolder);
                  }}
                >
                  <LucideIcon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>

          {labelsOpen ? (
            <div className="mt-2 border-t border-white/15 pt-2">
              <div className="mb-2 flex items-center justify-between px-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100">Mail labels</p>
                <button className="text-[11px] text-brand-100 hover:text-white" type="button" onClick={() => openCreateUserLabelEditor("NewLabel")}>Create</button>
              </div>
              <div className="space-y-2">
                {userLabels.length ? (
                  userLabels.map((label) => {
                    const labelColor = LABEL_COLOR_PALETTE[label.colorIndex % LABEL_COLOR_PALETTE.length];
                    const LabelIcon = LABEL_ICONS[label.iconIndex % LABEL_ICONS.length];
                    const isActive = selectedLabelId === label.id;
                    return (
                      <div
                        key={label.id}
                        className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${
                          isActive ? "bg-white text-brand-700" : "bg-white/5 text-white/80 hover:bg-white/10"
                        }`}
                      >
                        <button
                          className="flex flex-1 items-center gap-3 truncate text-left"
                          type="button"
                          onClick={() => {
                            setSelectedLabelId((current) => (current === label.id ? null : label.id));
                          }}
                        >
                          <LabelIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : labelColor.iconClass}`} />
                          <span className="truncate">{label.name}</span>
                          <span className={`ml-auto shrink-0 pr-1 text-xs ${isActive ? "text-brand-500" : "text-white/60"}`}>{labelCounts[label.id] ?? 0}</span>
                        </button>
                        <button
                          className={`shrink-0 rounded-lg p-1 transition ${
                            isActive ? "text-brand-400 hover:bg-brand-100 hover:text-brand-700" : "text-white/30 hover:bg-white/10 hover:text-white"
                          }`}
                          type="button"
                          title={`Edit ${label.name}`}
                          onClick={() => openEditUserLabelEditor(label.id)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className={`shrink-0 rounded-lg p-1 transition ${
                            isActive ? "text-brand-400 hover:bg-brand-100 hover:text-rose-600" : "text-white/30 hover:bg-white/10 hover:text-rose-300"
                          }`}
                          type="button"
                          title={`Delete ${label.name}`}
                          onClick={() => deleteUserLabel(label.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/40">
                    <Tag className="h-4 w-4 shrink-0" />
                    No labels yet. Create one.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-3 border-t border-white/15 pt-2">
            <div className="mb-2 flex items-center justify-between px-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100">IMAP folders (custom)</p>
              <div className="flex items-center gap-2">
                <button className="text-brand-100 hover:text-white" type="button" title="Create folder" onClick={() => promptCreateFolder()}>
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
                <button className="text-brand-100 hover:text-white" type="button" title="Sync folders" onClick={runFolderSync}>
                  <RefreshCcw className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div className="space-y-2">
              {customImapFolders.length ? (
                customImapFolders.map((folder) => {
                  const colorIndex = hashString(folder.name) % LABEL_COLOR_PALETTE.length;
                  const labelColor = LABEL_COLOR_PALETTE[colorIndex];
                  const LabelIcon = LABEL_ICONS[colorIndex % LABEL_ICONS.length];
                  const isActive = activeFolder === folder.path;
                  return (
                    <div
                      key={folder.path}
                      className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm transition ${
                        isActive ? "bg-white text-brand-700" : "bg-white/5 text-white/80 hover:bg-white/10"
                      }`}
                    >
                      <button
                        className="flex flex-1 items-center gap-3 truncate text-left"
                        type="button"
                        onClick={() => {
                          setActiveFolder(folder.path);
                          setSelectedLabelId(null);
                          setSelectedUid(null);
                          setSelectedMessageSourceFolder(null);
                        }}
                        onDragOver={(event) => {
                          if (!dragMoveMode) {
                            return;
                          }
                          event.preventDefault();
                        }}
                        onDrop={(event) => {
                          if (!dragMoveMode) {
                            return;
                          }
                          event.preventDefault();
                          void dropSelectedToFolder(folder.path);
                        }}
                      >
                        <LabelIcon className={`h-4 w-4 shrink-0 ${isActive ? "text-brand-600" : labelColor.iconClass}`} />
                        <span className="truncate">{folder.name}</span>
                      </button>
                      <button
                        className={`shrink-0 rounded-lg p-1 transition ${
                          isActive ? "text-brand-400 hover:bg-brand-100 hover:text-rose-600" : "text-white/30 hover:bg-white/10 hover:text-rose-300"
                        }`}
                        type="button"
                        title={`Delete ${folder.name}`}
                        onClick={() => {
                          const confirmed = window.confirm(`Delete folder "${folder.name}"?`);
                          if (confirmed) {
                            deleteFolderMutation.mutate(folder.path);
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <div className="flex w-full items-center gap-3 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/40">
                  <FolderPlus className="h-4 w-4 shrink-0" />
                  No custom folders yet.
                </div>
              )}
            </div>
          </div>

          {allowDesktopResize ? (
            <button
              aria-label="Resize sidebar"
              className="absolute right-[-3px] top-0 z-10 h-full w-1.5 cursor-col-resize bg-brand-200/30 transition hover:bg-brand-300/70"
              type="button"
              onMouseDown={() => setResizeTarget("sidebar")}
            />
          ) : null}
        </aside>

        <div
          ref={contentGridRef}
          className={`grid min-h-0 ${isListPane ? "" : isCompactViewport || !isRightPane ? "grid-rows-[320px_minmax(0,1fr)]" : ""}`}
          style={
            isListPane
              ? undefined
              : !isCompactViewport && isRightPane
                ? { gridTemplateColumns: `${listWidth}px minmax(0,1fr)` }
                : !isCompactViewport && !isRightPane
                  ? { gridTemplateRows: `${bottomPaneHeight}px minmax(0,1fr)` }
                  : undefined
          }
        >
          <section className={`relative min-h-0 flex-col bg-white ${isListPane && selectedUid !== null ? "hidden" : "flex"} ${!isListPane ? "border-r border-surface-200" : ""}`}>
            <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-surface-900">{activeFolderTitle}</p>
                <p className="text-xs text-surface-500">{filteredMessages.length} messages</p>
                {selectedMessageKeys.size ? <p className="text-xs text-brand-700">{selectedMessageKeys.size} selected</p> : null}
              </div>
              <button
                className="inline-flex items-center rounded-xl border border-brand-200 bg-white p-2 text-brand-700 hover:bg-brand-50"
                title="Refresh list"
                type="button"
                onClick={runMessagesSync}
              >
                <RefreshCcw className={`h-4 w-4 ${messagesQuery.isFetching ? "animate-spin" : ""}`} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-surface-200 px-3 py-2">
              <button
                className="rounded-xl border border-brand-200 px-2.5 py-1.5 text-xs text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                disabled={(!selectedMessageKeys.size && selectedUid === null) || moveMutation.isPending || moveBatchMutation.isPending || !archiveFolderPath}
                type="button"
                onClick={() => {
                  if (selectedMessageKeys.size) {
                    void moveSelectedMessages("archive");
                    return;
                  }
                  moveSelectedMessage(archiveFolderPath);
                }}
              >
                Move
              </button>
              <button
                className="rounded-xl border border-brand-200 px-2.5 py-1.5 text-xs text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                disabled={!activeSelectedMessages.length}
                type="button"
                onClick={() => promptAssignLabelToMessages(activeSelectedMessages)}
              >
                Label
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-surface-200 px-3 py-2">
              <div className="relative">
                <button
                  className={`inline-flex items-center gap-1 rounded-xl border px-2.5 py-1.5 text-xs ${selectionMode ? "border-brand-300 bg-brand-50 text-brand-700" : "border-brand-200 text-brand-700 hover:bg-brand-50"}`}
                  type="button"
                  onClick={() => setSelectMenuOpen((current) => !current)}
                >
                  Select
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {selectMenuOpen ? (
                  <div className="absolute left-0 top-[calc(100%+0.35rem)] z-20 w-36 rounded-xl border border-surface-200 bg-white p-1 shadow-panel">
                    <button className="block w-full rounded-lg px-3 py-2 text-left text-xs text-surface-700 hover:bg-surface-50" type="button" onClick={startSelectionMode}>
                      Select
                    </button>
                    <button className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs text-surface-700 hover:bg-surface-50" type="button" onClick={selectAllVisibleMessages}>
                      Select All
                    </button>
                    <button className="mt-1 block w-full rounded-lg px-3 py-2 text-left text-xs text-surface-700 hover:bg-surface-50" type="button" onClick={turnSelectionModeOff}>
                      Turn select off
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                className={`rounded-xl border border-brand-200 px-2.5 py-1.5 text-xs ${filterUnread ? "bg-brand-400 text-white" : "text-brand-700 hover:bg-brand-50"}`}
                type="button"
                onClick={() => setFilterUnread((current) => !current)}
              >
                Unread
              </button>
              <button
                className="rounded-xl border border-brand-200 px-2.5 py-1.5 text-xs text-brand-700 hover:bg-brand-50 disabled:opacity-50"
                disabled={(!selectedMessageKeys.size && selectedUid === null) || deleteMutation.isPending || moveBatchMutation.isPending}
                type="button"
                onClick={() => {
                  if (selectedMessageKeys.size) {
                    void deleteSelectedMessages();
                    return;
                  }
                  deleteSelectedMessage();
                }}
              >
                Delete
              </button>
              {dragMoveMode ? <p className="text-xs text-brand-700">Drag selected emails to a folder in the left sidebar.</p> : null}
            </div>

            {actionError ? <p className="border-b border-surface-200 px-3 py-2 text-xs text-rose-600">{actionError}</p> : null}

            <div className="border-b border-surface-200 bg-surface-50/70 px-3 py-2">
              <button
                className="mb-1 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-surface-500"
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                Advanced filters
                <ChevronDown className={`h-3.5 w-3.5 transition ${filtersOpen ? "rotate-180" : "rotate-0"}`} />
              </button>
              {filtersOpen ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Date</span>
                    <select
                      className="rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-xs text-brand-700 outline-none"
                      value={dateRange}
                      onChange={(event) => setDateRange(event.target.value as "all" | "7d" | "30d")}
                    >
                      <option value="all">Date: All</option>
                      <option value="7d">Date: 7d</option>
                      <option value="30d">Date: 30d</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Category</span>
                    <select
                      className="rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-xs text-brand-700 outline-none"
                      value={categoryFilter}
                      onChange={(event) => setCategoryFilter(event.target.value as CategoryType)}
                    >
                      <option value="all">Category: All</option>
                      {(["ops", "billing", "personal", "security", "marketing", "social", "support", "newsletters", "invoices", "receipts", "alerts", "system", "accounts", "payments", "shipping", "confirmations", "notifications", "feedback", "reports", "meetings", "documents", "spam"] as const).map((category) => (
                        <option key={category} value={category}>
                          Category: {category}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-surface-500">Status</span>
                    <select
                      className="rounded-xl border border-brand-200 bg-white px-2.5 py-1.5 text-xs text-brand-700 outline-none"
                      value={statusFilter}
                      onChange={(event) => setStatusFilter(event.target.value as "all" | "read" | "unread" | "flagged")}
                    >
                      <option value="all">Status: All</option>
                      <option value="read">Status: read (new)</option>
                      <option value="unread">Status: unread</option>
                      <option value="flagged">Status: flagged</option>
                    </select>
                  </label>
                </div>
              ) : null}
            </div>

            <div ref={listScrollRef} className="min-h-0 flex-1 overflow-y-auto hide-scrollbar" onScroll={handleListScroll}>
              {filteredMessages.map((message) => {
                const messageLabelIds = getMessageLabelIds(message);
                const messageLabels = messageLabelIds
                  .map((labelId) => userLabelMap.get(labelId))
                  .filter((label): label is UserLabel => Boolean(label));
                const primaryLabel = messageLabels[0];
                const extraLabelCount = Math.max(0, messageLabels.length - 1);
                const primaryLabelColor = primaryLabel ? LABEL_COLOR_PALETTE[primaryLabel.colorIndex % LABEL_COLOR_PALETTE.length] : null;
                const PrimaryLabelIcon = primaryLabel ? LABEL_ICONS[primaryLabel.iconIndex % LABEL_ICONS.length] : null;

                return (
                  <div
                    key={toMessageKey(message.folder, message.uid)}
                    className={`group flex w-full items-center gap-2 border-b border-surface-100 text-left transition hover:bg-brand-50 ${
                      settings.compactMessageRows ? "h-[60px] px-3 py-1.5" : "h-[72px] px-3 py-2"
                    } ${
                      selectedMessageKeys.has(toMessageKey(message.folder, message.uid)) || isMessageSelected(message) ? "bg-brand-50" : "bg-white"
                    }`}
                    role="button"
                    tabIndex={0}
                    draggable={selectionMode && (selectedMessageKeys.has(toMessageKey(message.folder, message.uid)) || dragMoveMode)}
                    onMouseDown={() => prefetchMessageDetail(message)}
                    onDragStart={(event) => {
                      if (!selectionMode) {
                        return;
                      }
                      if (!selectedMessageKeys.has(toMessageKey(message.folder, message.uid))) {
                        setSelectedMessageKeys(new Set([toMessageKey(message.folder, message.uid)]));
                      }
                      setDragMoveMode(true);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", toMessageKey(message.folder, message.uid));
                    }}
                    onClick={() => {
                      prefetchMessageDetail(message);
                      setSelectedUid(message.uid);
                      setSelectedMessageSourceFolder(message.folder);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        prefetchMessageDetail(message);
                        setSelectedUid(message.uid);
                        setSelectedMessageSourceFolder(message.folder);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!isListPane) {
                        setSelectedUid(message.uid);
                        setSelectedMessageSourceFolder(message.folder);
                      }
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        message
                      });
                    }}
                  >
                    {selectionMode ? (
                      <button
                        className="rounded p-0.5"
                        type="button"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          toggleMessageSelection(message);
                        }}
                      >
                        {selectedMessageKeys.has(toMessageKey(message.folder, message.uid)) ? (
                          <CheckSquare className="h-4 w-4 text-brand-600" />
                        ) : (
                          <Square className="h-4 w-4 text-surface-300" />
                        )}
                      </button>
                    ) : null}
                    <div className="flex items-center gap-1">
                      <div className={`h-2.5 w-2.5 rounded-full ${message.unread ? "bg-brand-600" : "bg-surface-200"}`} />
                      <button
                        className={`rounded p-0.5 transition-opacity ${message.flagged ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          event.preventDefault();
                          updateMessageState({ folder: message.folder, uid: message.uid, flagged: !message.flagged });
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            updateMessageState({ folder: message.folder, uid: message.uid, flagged: !message.flagged });
                          }
                        }}
                      >
                        <Star className={`h-3.5 w-3.5 shrink-0 ${message.flagged ? "fill-amber-400 text-amber-500" : "text-surface-500"}`} />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p title={message.from} className={`truncate text-xs text-surface-700 ${message.unread ? "font-medium" : "font-normal"}`}>{message.from}</p>
                        <p className="shrink-0 text-xs text-surface-500">{formatMessageListDate(message.date, settings.listDateMode)}</p>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <p title={message.subject} className={`min-w-0 flex-1 truncate text-sm leading-5 text-surface-900 ${message.unread ? "font-semibold" : "font-normal"}`}>{message.subject}</p>
                        {primaryLabel && PrimaryLabelIcon && primaryLabelColor ? (
                          <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${primaryLabelColor.badgeClass}`}>
                            <PrimaryLabelIcon className="h-3 w-3" />
                            <span className="max-w-[72px] truncate">{primaryLabel.name}</span>
                            {extraLabelCount ? <span>+{extraLabelCount}</span> : null}
                          </span>
                        ) : null}
                        {message.hasAttachments ? <Paperclip className="mt-0.5 h-3 w-3 shrink-0 text-surface-500" /> : null}
                      </div>
                      {settings.showMessagePreview ? (
                        <p title={message.preview} className="mt-0.5 truncate text-xs text-surface-500">{message.preview}</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {isLoadingMore ? (
                <div className="flex items-center justify-center py-4">
                  <RefreshCcw className="h-4 w-4 animate-spin text-brand-500" />
                </div>
              ) : null}
            </div>

            {isRightPane && allowDesktopResize ? (
              <button
                aria-label="Resize message list"
                className="absolute right-[-3px] top-0 z-10 h-full w-1.5 cursor-col-resize bg-brand-200/30 transition hover:bg-brand-300/70"
                type="button"
                onMouseDown={() => setResizeTarget("list")}
              />
            ) : null}

            {readingPane === "bottom" && allowDesktopResize ? (
              <button
                aria-label="Resize bottom pane"
                className="absolute bottom-[-3px] left-0 z-10 h-1.5 w-full cursor-row-resize bg-brand-200/30 transition hover:bg-brand-300/70"
                type="button"
                onMouseDown={() => setResizeTarget("bottom")}
              />
            ) : null}
          </section>

          {!isListPane || selectedUid !== null ? (
          <section className="min-h-0 bg-[linear-gradient(180deg,#f7fafe,#eef4fc)] p-6">
            {detail ? (
              <article className="flex h-full min-h-0 flex-col bg-white/85 p-6 shadow-panel backdrop-blur">
                {isListPane ? (
                  <div className="mb-4">
                    <button
                      className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                      type="button"
                      onClick={() => {
                        setSelectedUid(null);
                        setSelectedMessageSourceFolder(null);
                      }}
                    >
                      <ChevronDown className="h-3.5 w-3.5 rotate-90" />
                      Back to list
                    </button>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-surface-200 pb-5">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="mt-1 break-words text-xl font-semibold leading-tight text-surface-900 sm:text-2xl">{detail.subject}</h3>
                    <p className="mt-3 text-sm text-surface-600">From {detail.from}</p>
                    <p className="text-sm text-surface-500">To {detail.to}</p>
                    {detail.cc ? <p className="text-sm text-surface-500">Cc {detail.cc}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-3">
                    <div className="rounded-xl bg-brand-50 px-2.5 py-1.5 text-right text-xs text-brand-700">
                      <p className="whitespace-nowrap">{`${detail.date ? new Date(detail.date).toLocaleString() : "No timestamp"}, ${detail.unread ? "Unread" : "Read"}`}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl border border-surface-300 bg-white px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50"
                        type="button"
                        onClick={openForwardComposer}
                        title="Forward"
                      >
                        <Forward className="h-4 w-4" />
                        Forward
                      </button>
                      <button
                        className="rounded-lg border border-surface-300 bg-white p-2 text-surface-700 transition hover:bg-surface-50"
                        type="button"
                        onClick={() => deleteSelectedMessage({ folder: selectedMessageFolder, uid: selectedUid as number })}
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg border border-surface-300 bg-white p-2 text-surface-700 transition hover:bg-surface-50"
                        type="button"
                        onClick={() => moveSelectedMessage(archiveFolderPath ?? null, { folder: selectedMessageFolder, uid: selectedUid as number })}
                        disabled={!archiveFolderPath}
                        title="Archive"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                      <button
                        className="rounded-lg border border-surface-300 bg-white p-2 text-surface-700 transition hover:bg-surface-50"
                        type="button"
                        onClick={() => moveSelectedMessage(spamFolderPath ?? null, { folder: selectedMessageFolder, uid: selectedUid as number })}
                        disabled={!spamFolderPath}
                        title="Mark as Spam"
                      >
                        <Flag className="h-4 w-4" />
                      </button>
                      <button
                        className={`rounded-lg border p-2 transition ${detail.flagged ? "border-amber-300 bg-amber-50" : "border-surface-300 bg-white hover:bg-surface-50"}`}
                        type="button"
                        onClick={() => updateMessageState({ folder: selectedMessageFolder, uid: selectedUid as number, flagged: !detail.flagged })}
                        title="Star"
                      >
                        <Star className={`h-4 w-4 ${detail.flagged ? "fill-amber-400 text-amber-500" : "text-surface-700"}`} />
                      </button>
                      <div className="relative">
                        <button
                          className="rounded-lg border border-surface-300 bg-white p-2 text-surface-700 transition hover:bg-surface-50"
                          type="button"
                          onClick={() => setMessageHeaderMenuOpen(!messageHeaderMenuOpen)}
                          title="More options"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        {messageHeaderMenuOpen ? (
                          <>
                            <div className="fixed inset-0 z-40" onMouseDown={() => setMessageHeaderMenuOpen(false)} />
                            <div
                              className="absolute right-0 top-full z-50 mt-2 min-w-48 origin-top-right rounded-lg border border-surface-200 bg-white shadow-lg"
                              onMouseDown={(event) => event.stopPropagation()}
                            >
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50"
                                type="button"
                                onClick={() => {
                                  updateMessageState({ folder: selectedMessageFolder, uid: selectedUid as number, unread: !detail.unread });
                                  setMessageHeaderMenuOpen(false);
                                }}
                              >
                                {detail.unread ? "Mark as read" : "Mark as unread"}
                              </button>
                              <button
                                className="w-full px-4 py-2 text-left text-sm text-surface-700 hover:bg-surface-50"
                                type="button"
                                onClick={() => {
                                  moveSelectedMessage(inboxFolderPath);
                                  setMessageHeaderMenuOpen(false);
                                }}
                                disabled={!inboxFolderPath}
                              >
                                Move to Inbox
                              </button>
                            </div>
                          </>
                        ) : null}
                      </div>
                      <button
                        className="inline-flex items-center gap-2 rounded-2xl bg-brand-400 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500"
                        type="button"
                        onClick={openReplyComposer}
                      >
                        <Reply className="h-4 w-4" />
                        Reply
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 min-h-0 flex-1 overflow-y-auto overscroll-contain bg-surface-50 p-6 text-sm leading-7 text-surface-700 hide-scrollbar">
                  {detail.attachments.length ? (
                    <div className="mb-4 grid gap-2">
                      {detail.attachments.map((attachment) => {
                        const isPdf = attachment.contentType.includes("pdf") || attachment.filename.toLowerCase().endsWith(".pdf");

                        return (
                          <div key={attachment.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-surface-800">{attachment.filename}</p>
                              <p className="text-xs text-surface-500">{attachment.contentType} · {formatAttachmentSize(attachment.size)}</p>
                            </div>
                            <button
                              className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                              type="button"
                              onClick={() => {
                                void openMessageAttachment(attachment);
                              }}
                              disabled={activeAttachmentId === attachment.id}
                            >
                              {activeAttachmentId === attachment.id ? "Loading..." : isPdf ? "Open PDF" : "Download"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}

                  {detail.html ? (
                    <iframe
                      className="h-full w-full border-0 bg-surface-50"
                      referrerPolicy="no-referrer"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      srcDoc={buildMessageIframeDocument(detail.html)}
                      title={`Message body ${detail.uid}`}
                    />
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
          ) : null}
        </div>
      </div>

      <footer className="w-full border-t border-surface-200 bg-white px-6 py-4 text-xs text-surface-600">
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

      {settingsOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-surface-900/35 backdrop-blur-sm" onMouseDown={() => setSettingsOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-6xl rounded-[28px] border border-surface-200 bg-white p-6 shadow-panel"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Account Settings</p>
                  <h3 className="mt-2 text-xl font-semibold text-surface-900">Mailbox preferences</h3>
                  <p className="mt-1 text-sm text-surface-500">These settings are saved per signed-in account.</p>
                </div>
                <button
                  className="rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-500 hover:bg-surface-50"
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="max-h-96 overflow-y-auto rounded-2xl border border-surface-200 bg-surface-50/80 p-2">
                  <div className="grid gap-1.5">
                    {[
                      ["general", "General"],
                      ["notifications", "Notifications"],
                      ["labels", "Labels Sync"],
                      ["layout", "Layout"],
                      ["messages", "Messages"],
                      ["inbox", "Inbox"],
                      ["display", "Display"],
                      ["compose", "Compose"],
                      ["data", "Data"],
                      ["safety", "Safety"]
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        className={`w-full rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
                          settingsTab === key ? "bg-brand-100 text-brand-700" : "bg-white text-surface-600 hover:bg-surface-100"
                        }`}
                        type="button"
                        onClick={() => setSettingsTab(key as SettingsTab)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </aside>

                <div className="min-w-0 space-y-6">
                {settingsTab === "general" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Profile</p>
                    <label className="mt-3 block">
                      <span className="mb-2 block text-sm font-medium text-surface-700">Display name</span>
                      <input
                        className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none transition focus:border-brand-300"
                        value={settings.displayName}
                        onChange={(event) =>
                          setSettings((current) => ({
                            ...current,
                            displayName: event.target.value
                          }))
                        }
                        placeholder={buildDefaultDisplayName(session.email)}
                      />
                    </label>
                    <p className="mt-2 text-xs text-surface-500">Email identity remains {session.email}.</p>
                  </section>
                ) : null}

                {settingsTab === "notifications" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-800">Sound notifications</p>
                        <p className="text-xs text-surface-500">Play a tone when a new message arrives at the top of the active folder.</p>
                      </div>
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.soundEnabled ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                        type="button"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            soundEnabled: !current.soundEnabled
                          }))
                        }
                      >
                        {settings.soundEnabled ? "On" : "Off"}
                      </button>
                    </div>
                    <div className="mt-3">
                      <button
                        className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        type="button"
                        onClick={playNotificationTone}
                      >
                        Test sound
                      </button>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "labels" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-800">Synchronized labels</p>
                        <p className="text-xs text-surface-500">Keep webmail labels and custom IMAP folders in sync in both directions.</p>
                      </div>
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.syncLabelsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                        type="button"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            syncLabelsEnabled: !current.syncLabelsEnabled
                          }))
                        }
                      >
                        {settings.syncLabelsEnabled ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 text-xs text-surface-600 sm:grid-cols-3">
                      <div className="rounded-xl border border-surface-200 bg-white px-3 py-2">
                        <p className="font-semibold text-surface-700">Labels</p>
                        <p>{userLabels.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-white px-3 py-2">
                        <p className="font-semibold text-surface-700">Custom IMAP folders</p>
                        <p>{customImapFolders.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-white px-3 py-2">
                        <p className="font-semibold text-surface-700">Out of sync</p>
                        <p>{labelsMissingFolderCount + foldersMissingLabelCount}</p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-surface-500">
                        Missing folders for labels: {labelsMissingFolderCount} · Missing labels for folders: {foldersMissingLabelCount}
                      </p>
                      <button
                        className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        disabled={isSyncingLabels}
                        onClick={() => {
                          void syncLabelsWithImapFolders();
                        }}
                      >
                        {isSyncingLabels ? "Synchronizing..." : "Sync now"}
                      </button>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "layout" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <p className="text-sm font-semibold text-surface-800">Reading pane</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${readingPane === "right" ? "bg-brand-100 text-brand-700" : "bg-white text-surface-600 border border-surface-200"}`}
                        type="button"
                        onClick={() => setReadingPane("right")}
                      >
                        Right
                      </button>
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${readingPane === "bottom" ? "bg-brand-100 text-brand-700" : "bg-white text-surface-600 border border-surface-200"}`}
                        type="button"
                        onClick={() => setReadingPane("bottom")}
                      >
                        Bottom
                      </button>
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${readingPane === "list" ? "bg-brand-100 text-brand-700" : "bg-white text-surface-600 border border-surface-200"}`}
                        type="button"
                        onClick={() => setReadingPane("list")}
                      >
                        List only
                      </button>
                    </div>

                    <div className="mt-5 grid gap-4">
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Sidebar width: {sidebarWidth}px</span>
                        <input
                          className="mt-2 w-full"
                          type="range"
                          min={240}
                          max={420}
                          value={sidebarWidth}
                          onChange={(event) => setSidebarWidth(Number(event.target.value))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Message list width: {listWidth}px</span>
                        <input
                          className="mt-2 w-full"
                          type="range"
                          min={280}
                          max={620}
                          value={listWidth}
                          onChange={(event) => setListWidth(Number(event.target.value))}
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-[0.12em] text-surface-500">Bottom pane height: {bottomPaneHeight}px</span>
                        <input
                          className="mt-2 w-full"
                          type="range"
                          min={220}
                          max={640}
                          value={bottomPaneHeight}
                          onChange={(event) => setBottomPaneHeight(Number(event.target.value))}
                        />
                      </label>
                    </div>

                    <div className="mt-4">
                      <button
                        className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        type="button"
                        onClick={() => {
                          setReadingPane("right");
                          setSidebarWidth(272);
                          setListWidth(340);
                          setBottomPaneHeight(320);
                        }}
                      >
                        Reset layout defaults
                      </button>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "messages" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Message row density</p>
                            <p className="text-xs text-surface-500">Compact mode shows more rows in the list pane.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.compactMessageRows ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, compactMessageRows: !current.compactMessageRows }))}
                          >
                            {settings.compactMessageRows ? "Compact" : "Comfortable"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Preview snippet line</p>
                            <p className="text-xs text-surface-500">Show or hide message preview text in the list.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.showMessagePreview ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, showMessagePreview: !current.showMessagePreview }))}
                          >
                            {settings.showMessagePreview ? "Visible" : "Hidden"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-surface-700">List date style</span>
                          <select
                            className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                            value={settings.listDateMode}
                            onChange={(event) => {
                              const mode = event.target.value === "relative" ? "relative" : "absolute";
                              setSettings((current) => ({ ...current, listDateMode: mode }));
                            }}
                          >
                            <option value="absolute">Absolute (date)</option>
                            <option value="relative">Relative (today, yesterday, 2d ago)</option>
                          </select>
                        </label>
                      </div>

                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Mark as read on open</p>
                            <p className="text-xs text-surface-500">Automatically marks a message as read when opened.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.markAsReadOnOpen ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, markAsReadOnOpen: !current.markAsReadOnOpen }))}
                          >
                            {settings.markAsReadOnOpen ? "On" : "Off"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "inbox" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-surface-800">Auto-open first message</p>
                        <p className="text-xs text-surface-500">Automatically select the newest message when entering a folder.</p>
                      </div>
                      <button
                        className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.autoOpenFirstMessage ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                        type="button"
                        onClick={() =>
                          setSettings((current) => ({
                            ...current,
                            autoOpenFirstMessage: !current.autoOpenFirstMessage
                          }))
                        }
                      >
                        {settings.autoOpenFirstMessage ? "Enabled" : "Disabled"}
                      </button>
                    </div>

                    <label className="mt-4 block">
                      <span className="mb-2 block text-sm font-medium text-surface-700">Messages per page fetch</span>
                      <select
                        className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none"
                        value={settings.messagePageSize}
                        onChange={(event) => {
                          const raw = Number(event.target.value);
                          const pageSize = raw === 50 || raw === 100 ? raw : 25;
                          setSettings((current) => ({
                            ...current,
                            messagePageSize: pageSize
                          }));
                          setMessageLimit(pageSize);
                        }}
                      >
                        <option value={25}>25 messages</option>
                        <option value={50}>50 messages</option>
                        <option value={100}>100 messages</option>
                      </select>
                    </label>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Default date filter</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.defaultDateRange}
                          onChange={(event) => {
                            const value = event.target.value === "7d" || event.target.value === "30d" ? event.target.value : "all";
                            setSettings((current) => ({ ...current, defaultDateRange: value }));
                            setDateRange(value);
                          }}
                        >
                          <option value="all">All time</option>
                          <option value="7d">Last 7 days</option>
                          <option value="30d">Last 30 days</option>
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Default category filter</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.defaultCategoryFilter}
                          onChange={(event) => {
                            const value = isValidCategory(event.target.value) ? (event.target.value as CategoryType) : "all";
                            setSettings((current) => ({ ...current, defaultCategoryFilter: value }));
                            setCategoryFilter(value);
                          }}
                        >
                          <option value="all">All categories</option>
                          {(["ops", "billing", "personal", "security", "marketing", "social", "support", "newsletters", "invoices", "receipts", "alerts", "system", "accounts", "payments", "shipping", "confirmations", "notifications", "feedback", "reports", "meetings", "documents", "spam"] as const).map((category) => (
                            <option key={category} value={category}>
                              {category.charAt(0).toUpperCase() + category.slice(1)}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Default status filter</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.defaultStatusFilter}
                          onChange={(event) => {
                            const value = event.target.value === "read" || event.target.value === "unread" || event.target.value === "flagged" ? event.target.value : "all";
                            setSettings((current) => ({ ...current, defaultStatusFilter: value }));
                            setStatusFilter(value);
                          }}
                        >
                          <option value="all">All statuses</option>
                          <option value="read">Read</option>
                          <option value="unread">Unread</option>
                          <option value="flagged">Flagged</option>
                        </select>
                      </label>

                      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-surface-800">Unread only by default</p>
                          <p className="text-xs text-surface-500">Apply unread filtering when the inbox opens.</p>
                        </div>
                        <button
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.defaultUnreadOnly ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                          type="button"
                          onClick={() => {
                            const nextValue = !settings.defaultUnreadOnly;
                            setSettings((current) => ({ ...current, defaultUnreadOnly: nextValue }));
                            setFilterUnread(nextValue);
                          }}
                        >
                          {settings.defaultUnreadOnly ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4">
                      <button
                        className="rounded-xl border border-brand-200 bg-white px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        type="button"
                        onClick={() => {
                          setFilterUnread(settings.defaultUnreadOnly);
                          setDateRange(settings.defaultDateRange);
                          setCategoryFilter(settings.defaultCategoryFilter);
                          setStatusFilter(settings.defaultStatusFilter);
                        }}
                      >
                        Apply inbox defaults now
                      </button>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "data" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Folder auto refresh</p>
                            <p className="text-xs text-surface-500">Background refresh for IMAP folder list.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.autoRefreshFolders ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, autoRefreshFolders: !current.autoRefreshFolders }))}
                          >
                            {settings.autoRefreshFolders ? "On" : "Off"}
                          </button>
                        </div>
                        <label className="mt-4 block">
                          <span className="mb-2 block text-sm font-medium text-surface-700">Folder refresh interval</span>
                          <select
                            className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                            value={settings.folderRefreshSeconds}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              const interval = value === 30 || value === 120 || value === 300 ? value : 60;
                              setSettings((current) => ({ ...current, folderRefreshSeconds: interval }));
                            }}
                          >
                            <option value={30}>30 seconds</option>
                            <option value={60}>60 seconds</option>
                            <option value={120}>120 seconds</option>
                            <option value={300}>300 seconds</option>
                          </select>
                        </label>
                        <button
                          className="mt-4 rounded-xl border border-brand-200 bg-surface-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                          type="button"
                          onClick={runFolderSync}
                        >
                          Refresh folders now
                        </button>
                      </div>

                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Message auto refresh</p>
                            <p className="text-xs text-surface-500">Background refresh for the active message list.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.autoRefreshMessages ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, autoRefreshMessages: !current.autoRefreshMessages }))}
                          >
                            {settings.autoRefreshMessages ? "On" : "Off"}
                          </button>
                        </div>
                        <label className="mt-4 block">
                          <span className="mb-2 block text-sm font-medium text-surface-700">Message refresh interval</span>
                          <select
                            className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                            value={settings.messageRefreshSeconds}
                            onChange={(event) => {
                              const value = Number(event.target.value);
                              const interval = value === 15 || value === 60 || value === 120 ? value : 30;
                              setSettings((current) => ({ ...current, messageRefreshSeconds: interval }));
                            }}
                          >
                            <option value={15}>15 seconds</option>
                            <option value={30}>30 seconds</option>
                            <option value={60}>60 seconds</option>
                            <option value={120}>120 seconds</option>
                          </select>
                        </label>
                        <button
                          className="mt-4 rounded-xl border border-brand-200 bg-surface-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                          type="button"
                          onClick={runMessagesSync}
                        >
                          Refresh messages now
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "safety" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Confirm before delete</p>
                            <p className="text-xs text-surface-500">Prompt before deleting or moving a message to Trash.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.confirmBeforeDelete ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, confirmBeforeDelete: !current.confirmBeforeDelete }))}
                          >
                            {settings.confirmBeforeDelete ? "On" : "Off"}
                          </button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-surface-200 bg-white p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-surface-800">Confirm bulk actions</p>
                            <p className="text-xs text-surface-500">Ask confirmation for bulk move or bulk flag operations.</p>
                          </div>
                          <button
                            className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.confirmBeforeBulkActions ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                            type="button"
                            onClick={() => setSettings((current) => ({ ...current, confirmBeforeBulkActions: !current.confirmBeforeBulkActions }))}
                          >
                            {settings.confirmBeforeBulkActions ? "On" : "Off"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-surface-200 bg-white p-4">
                      <p className="text-sm font-semibold text-surface-800">Reset account preferences</p>
                      <p className="mt-1 text-xs text-surface-500">Restores all settings on this modal to default values for the signed-in account.</p>
                      <button
                        className="mt-3 rounded-xl border border-brand-200 bg-surface-50 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-50"
                        type="button"
                        onClick={() => {
                          if (!window.confirm("Reset all mailbox preferences for this account?")) {
                            return;
                          }

                          window.localStorage.removeItem(dashboardSettingsStorageKey);
                          const resetSettings = readDashboardSettings(dashboardSettingsStorageKey, session.email);
                          setSettings(resetSettings);
                          setFilterUnread(resetSettings.defaultUnreadOnly);
                          setDateRange(resetSettings.defaultDateRange);
                          setCategoryFilter(resetSettings.defaultCategoryFilter);
                          setStatusFilter(resetSettings.defaultStatusFilter);
                          setMessageLimit(resetSettings.messagePageSize);
                          
                          // Reset display settings
                          if (resetSettings.theme === "dark") {
                            document.documentElement.classList.add("dark");
                          } else if (resetSettings.theme === "light") {
                            document.documentElement.classList.remove("dark");
                          } else {
                            if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                              document.documentElement.classList.add("dark");
                            } else {
                              document.documentElement.classList.remove("dark");
                            }
                          }
                          
                          if (resetSettings.fontSize === "small") {
                            document.documentElement.style.fontSize = "14px";
                          } else if (resetSettings.fontSize === "large") {
                            document.documentElement.style.fontSize = "18px";
                          } else {
                            document.documentElement.style.fontSize = "16px";
                          }
                        }}
                      >
                        Reset preferences
                      </button>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "display" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Theme</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.theme}
                          onChange={(event) => {
                            const theme = event.target.value === "dark" || event.target.value === "light" ? event.target.value : "auto";
                            setSettings((current) => ({ ...current, theme }));
                            if (theme === "dark") {
                              document.documentElement.classList.add("dark");
                            } else if (theme === "light") {
                              document.documentElement.classList.remove("dark");
                            } else {
                              if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
                                document.documentElement.classList.add("dark");
                              } else {
                                document.documentElement.classList.remove("dark");
                              }
                            }
                          }}
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="auto">Auto (system)</option>
                        </select>
                      </label>

                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Font size</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.fontSize}
                          onChange={(event) => {
                            const size = event.target.value === "small" || event.target.value === "large" ? event.target.value : "medium";
                            setSettings((current) => ({ ...current, fontSize: size }));
                            if (size === "small") {
                              document.documentElement.style.fontSize = "14px";
                            } else if (size === "large") {
                              document.documentElement.style.fontSize = "18px";
                            } else {
                              document.documentElement.style.fontSize = "16px";
                            }
                          }}
                        >
                          <option value="small">Small (14px)</option>
                          <option value="medium">Medium (16px)</option>
                          <option value="large">Large (18px)</option>
                        </select>
                      </label>

                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Font family</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.fontFamily}
                          onChange={(event) => {
                            const family = event.target.value === "serif" || event.target.value === "monospace" ? event.target.value : "system";
                            setSettings((current) => ({ ...current, fontFamily: family }));
                            if (family === "serif") {
                              document.body.style.fontFamily = "Georgia, serif";
                            } else if (family === "monospace") {
                              document.body.style.fontFamily = "Fira Code, monospace";
                            } else {
                              document.body.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto";
                            }
                          }}
                        >
                          <option value="system">System</option>
                          <option value="serif">Serif</option>
                          <option value="monospace">Monospace</option>
                        </select>
                      </label>

                      <div className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white p-4">
                        <div>
                          <p className="text-sm font-medium text-surface-800">Keyboard shortcuts</p>
                          <p className="text-xs text-surface-500">Enable keyboard navigation in message list and composer.</p>
                        </div>
                        <button
                          className={`rounded-xl px-3 py-2 text-xs font-semibold ${settings.keyboardShortcutsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-surface-200 text-surface-600"}`}
                          type="button"
                          onClick={() => setSettings((current) => ({ ...current, keyboardShortcutsEnabled: !current.keyboardShortcutsEnabled }))}
                        >
                          {settings.keyboardShortcutsEnabled ? "Enabled" : "Disabled"}
                        </button>
                      </div>
                    </div>
                  </section>
                ) : null}

                {settingsTab === "compose" ? (
                  <section className="rounded-2xl border border-surface-200 bg-surface-50/70 p-4">
                    <div className="grid gap-4">
                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Reply format</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.replyFormat}
                          onChange={(event) => {
                            const format = event.target.value === "plain" ? "plain" : "html";
                            setSettings((current) => ({ ...current, replyFormat: format }));
                          }}
                        >
                          <option value="html">HTML (rich text)</option>
                          <option value="plain">Plain text</option>
                        </select>
                      </label>

                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Spam filter level</span>
                        <select
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none"
                          value={settings.spamFilterLevel}
                          onChange={(event) => {
                            const level = (event.target.value === "off" || event.target.value === "low" || event.target.value === "high") ? event.target.value : "medium";
                            setSettings((current) => ({ ...current, spamFilterLevel: level }));
                          }}
                        >
                          <option value="off">Off</option>
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </label>

                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Default reply-to email</span>
                        <input
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none transition focus:border-brand-300"
                          type="email"
                          value={settings.defaultReplyTo}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              defaultReplyTo: event.target.value
                            }))
                          }
                          placeholder="Optional: alternate reply-to email"
                        />
                        <p className="mt-1 text-xs text-surface-500">Leave blank to use your account email.</p>
                      </label>

                      <label className="block rounded-2xl border border-surface-200 bg-white p-4">
                        <span className="mb-2 block text-sm font-medium text-surface-700">Email signature</span>
                        <textarea
                          className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none transition focus:border-brand-300"
                          rows={5}
                          value={settings.emailSignature}
                          onChange={(event) =>
                            setSettings((current) => ({
                              ...current,
                              emailSignature: event.target.value
                            }))
                          }
                          placeholder="Your signature will be appended to new messages and replies"
                        />
                      </label>
                    </div>
                  </section>
                ) : null}
              </div>
            </div>
            </div>
          </div>
        </>
      ) : null}

      {contextMenu ? (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setContextMenu(null)} />
          <div
            ref={contextMenuRef}
            className="fixed z-50 min-w-44 rounded-xl border border-surface-200 bg-white p-2 shadow-panel"
            style={{ left: Math.max(8, contextMenu.x), top: Math.max(8, contextMenu.y) }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                startDragMove(contextMenu.message);
              }}
            >
              Move
            </button>
            {inboxFolderPath && contextMenu.message.folder !== inboxFolderPath ? (
              <button
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  moveSelectedMessage(inboxFolderPath, { folder: contextMenu.message.folder, uid: contextMenu.message.uid });
                  setContextMenu(null);
                }}
              >
                Move to Inbox
              </button>
            ) : null}
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                deleteSelectedMessage({ folder: contextMenu.message.folder, uid: contextMenu.message.uid });
                setContextMenu(null);
              }}
            >
              Remove
            </button>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50 disabled:opacity-50"
              disabled={!spamFolderPath || contextMenu.message.folder === spamFolderPath}
              type="button"
              hidden={Boolean(spamFolderPath && contextMenu.message.folder === spamFolderPath)}
              onClick={(event) => {
                event.stopPropagation();
                moveSelectedMessage(spamFolderPath, { folder: contextMenu.message.folder, uid: contextMenu.message.uid });
                setContextMenu(null);
              }}
            >
              Send to Spam
            </button>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateMessageState({ folder: contextMenu.message.folder, uid: contextMenu.message.uid, unread: true });
                setContextMenu(null);
              }}
            >
              Mark as Unread
            </button>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateMessageState({ folder: contextMenu.message.folder, uid: contextMenu.message.uid, unread: false });
                setContextMenu(null);
              }}
            >
              Mark as Read
            </button>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateMessageState({ folder: contextMenu.message.folder, uid: contextMenu.message.uid, flagged: true });
                setContextMenu(null);
              }}
            >
              Starred
            </button>
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                updateMessageState({ folder: contextMenu.message.folder, uid: contextMenu.message.uid, flagged: false });
                setContextMenu(null);
              }}
            >
              Unstarred
            </button>
            {userLabels.length ? (
              <div className="mt-2 border-t border-surface-200 pt-2">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-surface-400">Mail labels</p>
                <div className="space-y-1">
                  {userLabels.map((label) => {
                    const LabelIcon = LABEL_ICONS[label.iconIndex % LABEL_ICONS.length];
                    const labelColor = LABEL_COLOR_PALETTE[label.colorIndex % LABEL_COLOR_PALETTE.length];
                    const isAssigned = getMessageLabelIds(contextMenu.message).includes(label.id);
                    return (
                      <button
                        key={label.id}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          assignLabelToMessages([contextMenu.message], label.id);
                          setLabelsOpen(true);
                          setContextMenu(null);
                        }}
                      >
                        <LabelIcon className={`h-4 w-4 shrink-0 ${labelColor.iconClass}`} />
                        <span className="min-w-0 flex-1 truncate">{label.name}</span>
                        {isAssigned ? <Check className="h-4 w-4 shrink-0 text-brand-600" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <button
                className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMissingLabelsModalOpen(true);
                  setContextMenu(null);
                }}
              >
                Assign to Mail Label
              </button>
            )}
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                removeLabelsFromMessage(contextMenu.message);
                setContextMenu(null);
              }}
            >
              Clear Labels
            </button>
          </div>
        </>
      ) : null}

      {labelEditor ? (
        <>
          <div className="fixed inset-0 z-40 bg-surface-900/35 backdrop-blur-sm" onMouseDown={() => setLabelEditor(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-lg rounded-[28px] border border-surface-200 bg-white p-6 shadow-panel"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-500">Mail Labels</p>
                  <h3 className="mt-2 text-xl font-semibold text-surface-900">
                    {labelEditor.mode === "create" ? "Create label" : "Edit label"}
                  </h3>
                  <p className="mt-1 text-sm text-surface-500">Choose a name and icon for this label badge.</p>
                </div>
                <button
                  className="rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-500 hover:bg-surface-50"
                  type="button"
                  onClick={() => setLabelEditor(null)}
                >
                  Cancel
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-700" htmlFor="label-editor-name">
                    Label name
                  </label>
                  <input
                    id="label-editor-name"
                    className="w-full rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-900 outline-none transition focus:border-brand-300 focus:bg-white"
                    value={labelEditor.name}
                    onChange={(event) =>
                      setLabelEditor((current) => (current ? { ...current, name: event.target.value } : current))
                    }
                    placeholder="Example: Google"
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-surface-700">Choose icon</p>
                    <div className="rounded-full border border-surface-200 bg-surface-50 px-3 py-1 text-xs text-surface-500">
                      {LABEL_ICONS.length} icons
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                    {LABEL_ICONS.map((Icon, index) => {
                      const isActive = labelEditor.iconIndex === index;
                      const color = LABEL_COLOR_PALETTE[index % LABEL_COLOR_PALETTE.length];
                      return (
                        <button
                          key={LABEL_ICON_NAMES[index]}
                          className={`flex min-h-[92px] flex-col items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs transition ${
                            isActive
                              ? "border-brand-300 bg-brand-50 text-brand-700 shadow-sm"
                              : "border-surface-200 bg-white text-surface-500 hover:border-brand-200 hover:bg-surface-50"
                          }`}
                          type="button"
                          onClick={() =>
                            setLabelEditor((current) => (current ? { ...current, iconIndex: index } : current))
                          }
                        >
                          <div className={`flex h-10 w-10 items-center justify-center rounded-2xl ${isActive ? "bg-white" : "bg-surface-50"}`}>
                            <Icon className={`h-5 w-5 ${isActive ? "text-brand-600" : color.iconClass}`} />
                          </div>
                          <span className="text-center capitalize leading-4">{LABEL_ICON_NAMES[index]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  className="rounded-2xl border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50"
                  type="button"
                  onClick={() => setLabelEditor(null)}
                >
                  Cancel
                </button>
                <button
                  className="rounded-2xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
                  type="button"
                  onClick={saveLabelEditor}
                >
                  {labelEditor.mode === "create" ? "Create label" : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {missingLabelsModalOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-surface-900/35 backdrop-blur-sm" onMouseDown={() => setMissingLabelsModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="w-full max-w-md rounded-[28px] border border-surface-200 bg-white p-6 shadow-panel"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-500">Mail Labels Missing</p>
              <h3 className="mt-2 text-xl font-semibold text-surface-900">No mail labels exist yet</h3>
              <p className="mt-2 text-sm leading-6 text-surface-500">
                Create a mail label first from the Labels section in the left sidebar. Click Create, choose a name and icon,
                then right-click a message again to assign that label.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  className="rounded-2xl border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 hover:bg-surface-50"
                  type="button"
                  onClick={() => setMissingLabelsModalOpen(false)}
                >
                  Close
                </button>
                <button
                  className="rounded-2xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500"
                  type="button"
                  onClick={() => {
                    setMissingLabelsModalOpen(false);
                    setLabelsOpen(true);
                    openCreateUserLabelEditor("NewLabel");
                  }}
                >
                  Create mail label
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <ComposePanel
        draft={composerDraft}
        errorMessage={sendMutation.error?.message}
        draftSavedAt={draftSavedAt}
        isSavingDraft={saveDraftMutation.isPending}
        isSending={sendMutation.isPending}
        onClose={() => setComposerDraft(null)}
        onSaveDraft={(payload) => saveDraft(payload)}
        onSend={(payload) => sendMutation.mutate(payload)}
      />
    </>
  );
}