import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import nodemailer from "nodemailer";

import type { MailSession } from "./session-store.js";

type FolderInfo = {
  path: string;
  name: string;
  specialUse: string | null;
};

type TlsOptions = {
  rejectUnauthorized: boolean;
  servername?: string;
};

type MessagePreview = {
  uid: number;
  folder: string;
  subject: string;
  from: string;
  date: string | null;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

type MessageAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
};

type MoveBatchItem = {
  folder: string;
  uid: number;
};

type AddressTextLike = {
  text?: string;
  value?: Array<{
    address?: string | null;
  }>;
};

type FetchedPreviewMessage = {
  uid: number;
  envelope?: {
    subject?: string;
    from?: Array<{
      name?: string | null;
      address?: string | null;
    }>;
  };
  flags?: Set<string>;
  internalDate?: Date | string | null;
  bodyStructure?: unknown;
};

function toIsoString(value: Date | string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toAddressText(value: AddressTextLike | AddressTextLike[] | null | undefined): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    const entries = value.map((entry) => entry.text).filter((entry): entry is string => Boolean(entry));
    return entries.length ? entries.join(", ") : null;
  }

  return value.text ?? null;
}

function toAddressList(value: AddressTextLike | AddressTextLike[] | null | undefined): string[] {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => entry.value?.map((item) => item.address).filter((item): item is string => Boolean(item)) ?? []);
  }

  return value.value?.map((item) => item.address).filter((item): item is string => Boolean(item)) ?? [];
}

function getMailTlsOptions(host: string): TlsOptions {
  const shouldRejectUnauthorized = (process.env.MAIL_TLS_REJECT_UNAUTHORIZED ?? "false").toLowerCase() !== "false";

  return {
    rejectUnauthorized: shouldRejectUnauthorized,
    servername: host
  };
}

function bodyStructureHasAttachments(node: unknown): boolean {
  if (!node || typeof node !== "object") {
    return false;
  }

  const part = node as {
    disposition?: { type?: string };
    parameters?: { name?: string };
    dispositionParameters?: { filename?: string };
    childNodes?: unknown[];
  };

  const dispositionType = part.disposition?.type?.toLowerCase();
  if (dispositionType === "attachment") {
    return true;
  }

  if (part.dispositionParameters?.filename || part.parameters?.name) {
    return true;
  }

  return Array.isArray(part.childNodes) && part.childNodes.some((child) => bodyStructureHasAttachments(child));
}

function toPreview(folder: string, message: FetchedPreviewMessage): MessagePreview {
  return {
    uid: message.uid,
    folder,
    subject: message.envelope?.subject ?? "(no subject)",
    from: message.envelope?.from?.[0]
      ? `${message.envelope.from[0].name ?? ""} <${message.envelope.from[0].address ?? "unknown"}>`.trim()
      : "Unknown sender",
    date: toIsoString(message.internalDate),
    preview: (message.bodyStructure as { childNodes?: Array<{ type?: string }> } | undefined)?.childNodes?.[0]?.type ?? "Open message to view content",
    unread: !message.flags?.has("\\Seen"),
    flagged: message.flags?.has("\\Flagged") ?? false,
    hasAttachments: bodyStructureHasAttachments(message.bodyStructure)
  };
}

async function fetchFolderMessages(client: ImapFlow, folder: string, limit = 25): Promise<MessagePreview[]> {
  const mailbox = await client.mailboxOpen(folder);

  if (mailbox.exists === 0) {
    return [];
  }

  const start = Math.max(1, mailbox.exists - limit + 1);
  const range = `${start}:*`;
  const messages: MessagePreview[] = [];

  for await (const message of client.fetch(range, {
    uid: true,
    envelope: true,
    flags: true,
    internalDate: true,
    bodyStructure: true,
    source: false
  })) {
    messages.push(toPreview(folder, message as FetchedPreviewMessage));
  }

  return messages.reverse();
}

export async function verifyMailAccess(session: Omit<MailSession, "token" | "createdAt">): Promise<void> {
  const imapClient = new ImapFlow({
    host: session.imap.host,
    port: session.imap.port,
    secure: session.imap.secure,
    auth: {
      user: session.email,
      pass: session.password
    },
    tls: getMailTlsOptions(session.imap.host)
  });

  try {
    await imapClient.connect();
  } finally {
    await imapClient.logout().catch(() => undefined);
  }

  const transport = nodemailer.createTransport({
    host: session.smtp.host,
    port: session.smtp.port,
    secure: session.smtp.secure,
    auth: {
      user: session.email,
      pass: session.password
    },
    tls: getMailTlsOptions(session.smtp.host)
  });

  await transport.verify();
}

async function withImapClient<T>(session: MailSession, action: (client: ImapFlow) => Promise<T>): Promise<T> {
  const client = new ImapFlow({
    host: session.imap.host,
    port: session.imap.port,
    secure: session.imap.secure,
    auth: {
      user: session.email,
      pass: session.password
    },
    tls: getMailTlsOptions(session.imap.host)
  });

  try {
    await client.connect();
    return await action(client);
  } finally {
    await client.logout().catch(() => undefined);
  }
}

export function listFolders(session: MailSession): Promise<FolderInfo[]> {
  return withImapClient(session, async (client) => {
    const folders = await client.list();

    return folders.map((folder) => ({
      path: folder.path,
      name: folder.name,
      specialUse: folder.specialUse ?? null
    }));
  });
}

export function listMessages(session: MailSession, folder: string, limit = 25): Promise<MessagePreview[]> {
  return withImapClient(session, async (client) => fetchFolderMessages(client, folder, limit));
}

export function listStarredMessages(session: MailSession, folders: FolderInfo[], limitPerFolder = 100): Promise<MessagePreview[]> {
  return withImapClient(session, async (client) => {
    const sourceFolders = folders.filter((folder) => folder.specialUse !== "\\Trash" && folder.specialUse !== "\\Junk");
    const results = await Promise.all(
      sourceFolders.map(async (folder) => {
        const messages = await fetchFolderMessages(client, folder.path, limitPerFolder);
        return messages.filter((message) => message.flagged);
      })
    );

    return results
      .flat()
      .sort((left, right) => Date.parse(right.date ?? "1970-01-01") - Date.parse(left.date ?? "1970-01-01"));
  });
}

export function getMessage(session: MailSession, folder: string, uid: number) {
  return withImapClient(session, async (client) => {
    await client.mailboxOpen(folder);

    const message = await client.fetchOne(
      uid,
      {
        uid: true,
        envelope: true,
        flags: true,
        internalDate: true,
        source: true
      },
      { uid: true }
    );

    if (!message || !message.source) {
      throw new Error("Message not found.");
    }

    const parsed = await simpleParser(message.source);
    const attachments: MessageAttachment[] = parsed.attachments.map((attachment, index) => {
      const filename = attachment.filename ?? `attachment-${index + 1}`;
      const contentBase64 = Buffer.isBuffer(attachment.content)
        ? attachment.content.toString("base64")
        : Buffer.from(String(attachment.content ?? ""), "utf8").toString("base64");

      return {
        id: `${message.uid}-${index}`,
        filename,
        contentType: attachment.contentType || "application/octet-stream",
        size: attachment.size,
        contentBase64
      };
    });

    return {
      uid: message.uid,
      subject: parsed.subject ?? message.envelope?.subject ?? "(no subject)",
      from: parsed.from?.text ?? "Unknown sender",
      to: toAddressText(parsed.to) ?? session.email,
      cc: toAddressText(parsed.cc),
      replyTo: toAddressList(parsed.replyTo).length ? toAddressList(parsed.replyTo) : toAddressList(parsed.from),
      messageId: parsed.messageId ?? null,
      references: Array.isArray(parsed.references) ? parsed.references : parsed.references ? [parsed.references] : [],
      date: toIsoString(parsed.date) ?? toIsoString(message.internalDate),
      text: parsed.text ?? "",
      html: typeof parsed.html === "string" ? parsed.html : null,
      unread: !message.flags?.has("\\Seen"),
      attachments
    };
  });
}

export function deleteMessage(session: MailSession, folder: string, uid: number): Promise<void> {
  return withImapClient(session, async (client) => {
    await client.mailboxOpen(folder);
    await client.messageDelete(uid, { uid: true });
  });
}

export function moveMessage(session: MailSession, folder: string, uid: number, destination: string): Promise<void> {
  return withImapClient(session, async (client) => {
    if (folder === destination) {
      return;
    }

    await client.mailboxOpen(folder);
    await client.messageMove(uid, destination, { uid: true });
  });
}

export function moveMessagesBatch(session: MailSession, items: MoveBatchItem[], destination: string): Promise<void> {
  return withImapClient(session, async (client) => {
    let lastOpenedFolder: string | null = null;

    for (const item of items) {
      if (item.folder === destination) {
        continue;
      }

      if (lastOpenedFolder !== item.folder) {
        await client.mailboxOpen(item.folder);
        lastOpenedFolder = item.folder;
      }

      await client.messageMove(item.uid, destination, { uid: true });
    }
  });
}

export function updateMessageFlags(
  session: MailSession,
  folder: string,
  uid: number,
  options: { unread?: boolean; flagged?: boolean }
): Promise<void> {
  return withImapClient(session, async (client) => {
    await client.mailboxOpen(folder);

    if (typeof options.unread === "boolean") {
      if (options.unread) {
        await client.messageFlagsRemove(uid, ["\\Seen"], { uid: true });
      } else {
        await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
      }
    }

    if (typeof options.flagged === "boolean") {
      if (options.flagged) {
        await client.messageFlagsAdd(uid, ["\\Flagged"], { uid: true });
      } else {
        await client.messageFlagsRemove(uid, ["\\Flagged"], { uid: true });
      }
    }
  });
}

export async function sendMessage(
  session: MailSession,
  payload: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject: string;
    text?: string;
    html?: string;
    inReplyTo?: string;
    references?: string[];
  }
): Promise<void> {
  const transport = nodemailer.createTransport({
    host: session.smtp.host,
    port: session.smtp.port,
    secure: session.smtp.secure,
    auth: {
      user: session.email,
      pass: session.password
    },
    tls: getMailTlsOptions(session.smtp.host)
  });

  await transport.sendMail({
    from: session.email,
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    inReplyTo: payload.inReplyTo,
    references: payload.references
  });
}

export function createFolder(session: MailSession, folder: string): Promise<void> {
  return withImapClient(session, async (client) => {
    await client.mailboxCreate(folder);
  });
}

export function deleteFolder(session: MailSession, folder: string): Promise<void> {
  return withImapClient(session, async (client) => {
    await client.mailboxDelete(folder);
  });
}

function buildDraftRawMessage(
  session: MailSession,
  payload: {
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    text?: string;
    html?: string;
    inReplyTo?: string;
    references?: string[];
  }
) {
  const headers: string[] = [];
  headers.push(`From: ${session.email}`);
  if (payload.to?.length) {
    headers.push(`To: ${payload.to.join(", ")}`);
  }
  if (payload.cc?.length) {
    headers.push(`Cc: ${payload.cc.join(", ")}`);
  }
  if (payload.bcc?.length) {
    headers.push(`Bcc: ${payload.bcc.join(", ")}`);
  }
  headers.push(`Subject: ${payload.subject?.trim() || "(no subject)"}`);
  headers.push(`Date: ${new Date().toUTCString()}`);
  headers.push("MIME-Version: 1.0");
  headers.push("Content-Type: text/plain; charset=utf-8");
  if (payload.inReplyTo) {
    headers.push(`In-Reply-To: ${payload.inReplyTo}`);
  }
  if (payload.references?.length) {
    headers.push(`References: ${payload.references.join(" ")}`);
  }

  const body = payload.text?.trim() || payload.html?.replace(/<[^>]+>/g, " ").trim() || "Draft";
  return `${headers.join("\r\n")}\r\n\r\n${body}\r\n`;
}

export function saveDraftMessage(
  session: MailSession,
  payload: {
    folder: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    text?: string;
    html?: string;
    inReplyTo?: string;
    references?: string[];
  }
): Promise<void> {
  return withImapClient(session, async (client) => {
    const raw = buildDraftRawMessage(session, payload);
    await client.append(payload.folder, raw, ["\\Draft"]);
  });
}
