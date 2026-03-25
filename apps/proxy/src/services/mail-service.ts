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
  subject: string;
  from: string;
  date: string | null;
  preview: string;
  unread: boolean;
  flagged: boolean;
};

type AddressTextLike = {
  text?: string;
  value?: Array<{
    address?: string | null;
  }>;
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
  return withImapClient(session, async (client) => {
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
      messages.push({
        uid: message.uid,
        subject: message.envelope?.subject ?? "(no subject)",
        from: message.envelope?.from?.[0]
          ? `${message.envelope.from[0].name ?? ""} <${message.envelope.from[0].address ?? "unknown"}>`.trim()
          : "Unknown sender",
        date: toIsoString(message.internalDate),
        preview: message.bodyStructure?.childNodes?.[0]?.type ?? "Open message to view content",
        unread: !message.flags?.has("\\Seen"),
        flagged: message.flags?.has("\\Flagged") ?? false
      });
    }

    return messages.reverse();
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
      unread: !message.flags?.has("\\Seen")
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
    await client.mailboxOpen(folder);
    await client.messageMove(uid, destination, { uid: true });
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