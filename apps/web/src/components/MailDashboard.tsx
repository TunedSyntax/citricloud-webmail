import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  Bell,
  Bookmark,
  Briefcase,
  Check,
  CheckSquare,
  CirclePlus,
  ChevronDown,
  FolderPlus,
  Globe,
  Inbox,
  LayoutPanelTop,
  LogOut,
  PanelBottom,
  PanelRight,
  Paperclip,
  Pencil,
  RefreshCcw,
  Reply,
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

const LABEL_ICONS = [Tag, Bookmark, Bell, Zap, Globe, Briefcase, Star, ShieldAlert] as const;
const LABEL_ICON_NAMES = ["tag", "bookmark", "bell", "zap", "globe", "briefcase", "star", "shield"] as const;

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
  return value === "bottom" ? "bottom" : "right";
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
  const [readingPane, setReadingPane] = useState<"right" | "bottom">(() => readStoredPane());
  const [sidebarWidth, setSidebarWidth] = useState(() => readStoredNumber(sidebarWidthStorageKey, 272, 240, 420));
  const [listWidth, setListWidth] = useState(() => readStoredNumber(listWidthStorageKey, 340, 280, 620));
  const [bottomPaneHeight, setBottomPaneHeight] = useState(() => readStoredNumber(bottomPaneHeightStorageKey, 320, 220, 640));
  const [resizeTarget, setResizeTarget] = useState<"sidebar" | "list" | "bottom" | null>(null);
  const [paneMenuOpen, setPaneMenuOpen] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);
  const [dateRange, setDateRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "ops" | "security" | "billing">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "unread" | "flagged">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [userLabels, setUserLabels] = useState<UserLabel[]>([]);
  const [messageLabelAssignments, setMessageLabelAssignments] = useState<MessageLabelAssignments>({});
  const [composerDraft, setComposerDraft] = useState<ComposeDraft | null>(null);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; message: MessagePreview } | null>(null);
  const [selectedMessageSourceFolder, setSelectedMessageSourceFolder] = useState<string | null>(null);
  const [selectedMessageKeys, setSelectedMessageKeys] = useState<Set<string>>(new Set());
  const [dragMoveMode, setDragMoveMode] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const contentGridRef = useRef<HTMLDivElement | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const userLabelsStorageKey = `${userLabelsStorageKeyPrefix}.${session.email.toLowerCase()}`;
  const messageLabelAssignmentsStorageKey = `${messageLabelAssignmentsStorageKeyPrefix}.${session.email.toLowerCase()}`;

  const foldersQuery = useQuery({
    queryKey: ["folders", session.token],
    queryFn: () => getFolders(session.token),
    initialData: { folders: initialFolders },
    staleTime: 0,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", session.token, activeFolder],
    queryFn: () => getMessages(session.token, activeFolder),
    staleTime: 0,
    refetchInterval: 30_000,
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
    enabled: selectedUid !== null
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
    onSuccess: () => {
      messagesQuery.refetch();
      selectedMessageQuery.refetch();
      setActionError(null);
    },
    onError: (error: Error) => {
      setActionError(error.message || "Unable to update message state.");
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
    if (messagesQuery.data?.messages.length && selectedUid === null) {
      const firstMessage = messagesQuery.data.messages[0];
      setSelectedUid(firstMessage.uid);
      setSelectedMessageSourceFolder(firstMessage.folder);
    }
  }, [messagesQuery.data, selectedUid]);

  useEffect(() => {
    if (!selectedPreview) {
      return;
    }

    setSelectedMessageSourceFolder(selectedPreview.folder);
  }, [selectedPreview]);

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
  }, [activeFolder]);

  useEffect(() => {
    if (!selectedMessageKeys.size) {
      setDragMoveMode(false);
    }
  }, [selectedMessageKeys]);

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

    const stillExists = messagesQuery.data.messages.some((message) => message.uid === selectedUid);
    if (!stillExists) {
      const firstMessage = messagesQuery.data.messages[0];
      setSelectedUid(firstMessage?.uid ?? null);
      setSelectedMessageSourceFolder(firstMessage?.folder ?? null);
    }
  }, [messagesQuery.data?.messages, selectedUid]);

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

  const promptCreateUserLabel = (defaultName = "") => {
    const name = window.prompt("Enter label name", defaultName)?.trim();
    if (!name) {
      return;
    }

    createUserLabel(name);
    setLabelsOpen(true);
  };

  const promptEditUserLabel = (labelId: string) => {
    const label = userLabels.find((item) => item.id === labelId);
    if (!label) {
      return;
    }

    const nextName = window.prompt("Edit label name", label.name)?.trim();
    if (!nextName) {
      return;
    }

    const iconHint = LABEL_ICON_NAMES.join(", ");
    const nextIconName = window.prompt(`Edit label icon (${iconHint})`, LABEL_ICON_NAMES[label.iconIndex] ?? LABEL_ICON_NAMES[0])?.trim().toLowerCase();
    if (!nextIconName) {
      return;
    }

    const nextIconIndex = LABEL_ICON_NAMES.findIndex((iconName) => iconName === nextIconName);
    if (nextIconIndex === -1) {
      setActionError(`Unknown icon. Use one of: ${iconHint}.`);
      return;
    }

    setUserLabels((current) =>
      current.map((item) =>
        item.id === labelId
          ? {
              ...item,
              name: nextName,
              iconIndex: nextIconIndex,
              colorIndex: hashString(nextName) % LABEL_COLOR_PALETTE.length
            }
          : item
      )
    );
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

      if (selectedLabelId && !getMessageLabelIds(message).includes(selectedLabelId)) {
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
    return matched?.label ?? "Inbox";
  }, [activeFolder, archiveFolderPath, availableFolders, inboxFolderPath, spamFolderPath]);

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

  const isRightPane = readingPane === "right";
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
              title={readingPane === "right" ? "Right pane view" : "Bottom pane view"}
              type="button"
              onClick={() => setPaneMenuOpen((current) => !current)}
            >
              {readingPane === "right" ? <PanelRight className="h-4 w-4" /> : <PanelBottom className="h-4 w-4" />}
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
              </div>
            ) : null}
          </div>
          <button className="inline-flex items-center gap-2 rounded-2xl bg-brand-400 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-500" type="button" onClick={openNewComposer}>
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

      <div
        ref={gridRef}
        className="grid min-h-0"
        style={allowDesktopResize ? { gridTemplateColumns: `${sidebarWidth}px minmax(0,1fr)` } : { gridTemplateColumns: "minmax(0,1fr)" }}
      >
        <aside className={`relative flex min-h-0 flex-col overflow-y-auto bg-[linear-gradient(180deg,#0b2141,#14345f)] p-5 text-white hide-scrollbar ${allowDesktopResize ? "border-r border-surface-200" : "border-b border-surface-200"}`}>
          <div className="mb-4 border-b border-white/20 pb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-100">Connected environment</p>
            <p className="mt-2 text-base font-semibold">{session.presetKey}</p>
            <p className="text-xs text-brand-100">{session.email}</p>
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
                    (item.label === "Labels" ? labelsOpen : activeSidebarLabel === item.label) ? "bg-white text-brand-700" : "bg-white/5 text-white/80 hover:bg-white/10"
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
                <button className="text-[11px] text-brand-100 hover:text-white" type="button" onClick={() => promptCreateUserLabel("NewLabel")}>Create</button>
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
                          onClick={() => promptEditUserLabel(label.id)}
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
          className={`grid min-h-0 ${isCompactViewport || !isRightPane ? "grid-rows-[320px_minmax(0,1fr)]" : ""}`}
          style={
            !isCompactViewport && isRightPane
              ? { gridTemplateColumns: `${listWidth}px minmax(0,1fr)` }
              : !isCompactViewport && !isRightPane
                ? { gridTemplateRows: `${bottomPaneHeight}px minmax(0,1fr)` }
              : undefined
          }
        >
          <section className="relative flex min-h-0 flex-col border-r border-surface-200 bg-white">
            <div className="flex items-center justify-between border-b border-surface-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-surface-900">{activeFolderTitle}</p>
                <p className="text-xs text-surface-500">{filteredMessages.length} messages</p>
                {selectedMessageKeys.size ? <p className="text-xs text-brand-700">{selectedMessageKeys.size} selected</p> : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-surface-200 px-3 py-2">
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
              {filtersOpen ? <div className="flex flex-wrap gap-1.5">
                {["all", "today", "7d", "30d"].map((value) => (
                  <button
                    key={`date-${value}`}
                    className={`rounded-xl px-2 py-0.5 text-[11px] ${dateRange === value ? "bg-brand-400 text-white" : "border border-brand-200 bg-white text-brand-700"}`}
                    type="button"
                    onClick={() => setDateRange(value as "all" | "today" | "7d" | "30d")}
                  >
                    {value === "all" ? "Date: All" : `Date: ${value}`}
                  </button>
                ))}
                {["all", "ops", "security", "billing"].map((value) => (
                  <button
                    key={`cat-${value}`}
                    className={`rounded-xl px-2 py-0.5 text-[11px] ${categoryFilter === value ? "bg-brand-400 text-white" : "border border-brand-200 bg-white text-brand-700"}`}
                    type="button"
                    onClick={() => setCategoryFilter(value as "all" | "ops" | "security" | "billing")}
                  >
                    {value === "all" ? "Category: All" : `Category: ${value}`}
                  </button>
                ))}
                {["all", "unread", "flagged"].map((value) => (
                  <button
                    key={`status-${value}`}
                    className={`rounded-xl px-2 py-0.5 text-[11px] ${statusFilter === value ? "bg-brand-400 text-white" : "border border-brand-200 bg-white text-brand-700"}`}
                    type="button"
                    onClick={() => setStatusFilter(value as "all" | "unread" | "flagged")}
                  >
                    {value === "all" ? "Status: All" : `Status: ${value}`}
                  </button>
                ))}
              </div> : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto hide-scrollbar">
              {filteredMessages.map((message) => {
                const messageLabelIds = getMessageLabelIds(message);
                const messageLabels = messageLabelIds
                  .map((labelId) => userLabelMap.get(labelId))
                  .filter((label): label is UserLabel => Boolean(label));

                return (
                  <div
                    key={message.uid}
                    className={`flex w-full items-center gap-2.5 border-b border-surface-100 px-3 py-2 text-left transition hover:bg-brand-50 ${
                      selectedMessageKeys.has(toMessageKey(message.folder, message.uid)) || selectedUid === message.uid ? "bg-brand-50" : "bg-white"
                    }`}
                    role="button"
                    tabIndex={0}
                    draggable={selectedMessageKeys.has(toMessageKey(message.folder, message.uid)) || dragMoveMode}
                    onDragStart={(event) => {
                      if (!selectedMessageKeys.has(toMessageKey(message.folder, message.uid))) {
                        setSelectedMessageKeys(new Set([toMessageKey(message.folder, message.uid)]));
                      }
                      setDragMoveMode(true);
                      event.dataTransfer.effectAllowed = "move";
                      event.dataTransfer.setData("text/plain", toMessageKey(message.folder, message.uid));
                    }}
                    onClick={() => {
                      setSelectedUid(message.uid);
                      setSelectedMessageSourceFolder(message.folder);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedUid(message.uid);
                        setSelectedMessageSourceFolder(message.folder);
                      }
                    }}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setSelectedUid(message.uid);
                      setSelectedMessageSourceFolder(message.folder);
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        message
                      });
                    }}
                  >
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
                    <div className="flex items-center gap-1">
                      <div className={`h-2.5 w-2.5 rounded-full ${message.unread ? "bg-brand-600" : "bg-surface-200"}`} />
                      <button
                        className="rounded p-0.5"
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
                        <Star className={`h-3.5 w-3.5 shrink-0 ${message.flagged ? "fill-amber-400 text-amber-500" : "text-surface-300"}`} />
                      </button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`truncate text-xs text-surface-700 ${message.unread ? "font-medium" : "font-normal"}`}>{message.from}</p>
                        <p className="shrink-0 text-xs text-surface-500">{message.date ? new Date(message.date).toLocaleDateString() : "Now"}</p>
                      </div>
                      <div className="mt-0.5 flex items-start gap-1.5">
                        <p className={`break-words text-sm leading-5 text-surface-900 ${message.unread ? "font-semibold" : "font-normal"}`}>{message.subject}</p>
                        {message.hasAttachments ? <Paperclip className="mt-0.5 h-3 w-3 shrink-0 text-surface-500" /> : null}
                      </div>
                      {messageLabels.length ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {messageLabels.map((label) => {
                            const labelColor = LABEL_COLOR_PALETTE[label.colorIndex % LABEL_COLOR_PALETTE.length];
                            return (
                              <span
                                key={label.id}
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${labelColor.badgeClass}`}
                              >
                                {label.name}
                              </span>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>

            {isRightPane && allowDesktopResize ? (
              <button
                aria-label="Resize message list"
                className="absolute right-[-3px] top-0 z-10 h-full w-1.5 cursor-col-resize bg-brand-200/30 transition hover:bg-brand-300/70"
                type="button"
                onMouseDown={() => setResizeTarget("list")}
              />
            ) : null}

            {!isRightPane && allowDesktopResize ? (
              <button
                aria-label="Resize bottom pane"
                className="absolute bottom-[-3px] left-0 z-10 h-1.5 w-full cursor-row-resize bg-brand-200/30 transition hover:bg-brand-300/70"
                type="button"
                onMouseDown={() => setResizeTarget("bottom")}
              />
            ) : null}
          </section>

          <section className="min-h-0 bg-[linear-gradient(180deg,#f7fafe,#eef4fc)] p-6">
            {detail ? (
              <article className="flex h-full min-h-0 flex-col bg-white/85 p-6 shadow-panel backdrop-blur">
                <div className="flex items-start justify-between gap-3 border-b border-surface-200 pb-5">
                  <div className="min-w-0 flex-1 pr-2">
                    <h3 className="mt-1 break-words text-xl font-semibold leading-tight text-surface-900 sm:text-2xl">{detail.subject}</h3>
                    <p className="mt-3 text-sm text-surface-600">From {detail.from}</p>
                    <p className="text-sm text-surface-500">To {detail.to}</p>
                    {detail.cc ? <p className="text-sm text-surface-500">Cc {detail.cc}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <div className="rounded-xl bg-brand-50 px-2.5 py-1.5 text-right text-xs text-brand-700">
                      <p className="whitespace-nowrap">{`${detail.date ? new Date(detail.date).toLocaleString() : "No timestamp"}, ${detail.unread ? "Unread" : "Read"}`}</p>
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
                              className="rounded-lg border border-brand-200 px-2.5 py-1 text-xs text-brand-700 hover:bg-brand-50"
                              type="button"
                              onClick={() => openAttachment(attachment.contentBase64, attachment.contentType, attachment.filename)}
                            >
                              {isPdf ? "Open PDF" : "Download"}
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
            <button
              className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-surface-50"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                promptAssignLabelToMessages([contextMenu.message]);
                setLabelsOpen(true);
                setContextMenu(null);
              }}
            >
              Assign Label
            </button>
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