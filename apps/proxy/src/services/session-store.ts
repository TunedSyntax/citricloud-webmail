import path from "node:path";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";

import { createClient } from "redis";

import type { UserRole } from "../config/rbac.js";

export type MailSession = {
  token: string;
  email: string;
  password: string;
  role: UserRole;
  presetKey: string;
  imap: {
    host: string;
    port: number;
    secure: boolean;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
  };
  createdAt: string;
};

type StoredSessionRecord = {
  payload: string;
  iv: string;
  tag: string;
  expiresAt: string;
};

type SessionStorageMode = "encrypted-file" | "redis";

const sessionTtlSeconds = Number.parseInt(process.env.SESSION_TTL_SECONDS ?? "86400", 10);
const sessionStorageMode: SessionStorageMode = process.env.SESSION_STORAGE === "redis" || process.env.REDIS_URL
  ? "redis"
  : "encrypted-file";
const sessionFilePath = process.env.SESSION_FILE_PATH ?? path.resolve(process.cwd(), "data", "sessions.enc.json");
const sessionRedisPrefix = process.env.SESSION_REDIS_PREFIX ?? "citricloud:webmail:session:";

let redisClientPromise: Promise<ReturnType<typeof createClient>> | null = null;

function getEncryptionKey(): Buffer {
  const secret = process.env.SESSION_ENCRYPTION_KEY ?? "citricloud-development-session-key";
  return createHash("sha256").update(secret).digest();
}

function encryptSession(session: MailSession): StoredSessionRecord {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const payload = Buffer.concat([cipher.update(JSON.stringify(session), "utf8"), cipher.final()]);

  return {
    payload: payload.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    expiresAt: new Date(Date.now() + sessionTtlSeconds * 1000).toISOString()
  };
}

function decryptSession(record: StoredSessionRecord): MailSession | undefined {
  if (Date.parse(record.expiresAt) <= Date.now()) {
    return undefined;
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));

  const payload = Buffer.concat([
    decipher.update(Buffer.from(record.payload, "base64")),
    decipher.final()
  ]);

  return JSON.parse(payload.toString("utf8")) as MailSession;
}

async function ensureSessionDirectory(): Promise<void> {
  await mkdir(path.dirname(sessionFilePath), { recursive: true });
}

async function writeStoredSessions(store: Record<string, StoredSessionRecord>): Promise<void> {
  await ensureSessionDirectory();
  const temporaryFilePath = `${sessionFilePath}.tmp`;

  await writeFile(temporaryFilePath, JSON.stringify(store, null, 2), "utf8");
  await rename(temporaryFilePath, sessionFilePath);
}

async function readStoredSessions(): Promise<Record<string, StoredSessionRecord>> {
  try {
    const content = await readFile(sessionFilePath, "utf8");
    const parsed = JSON.parse(content) as Record<string, StoredSessionRecord>;
    const activeEntries = Object.entries(parsed).filter(([, record]) => Date.parse(record.expiresAt) > Date.now());

    if (activeEntries.length !== Object.keys(parsed).length) {
      await writeStoredSessions(Object.fromEntries(activeEntries));
    }

    return Object.fromEntries(activeEntries);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function getRedisClient() {
  if (!redisClientPromise) {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error("REDIS_URL is required when Redis session storage is enabled.");
    }

    const client = createClient({ url: redisUrl });
    client.on("error", (error) => {
      console.error("Redis session store error", error);
    });

    redisClientPromise = client.connect().then(() => client);
  }

  return redisClientPromise;
}

export async function createSession(payload: Omit<MailSession, "token" | "createdAt">): Promise<MailSession> {
  const session: MailSession = {
    ...payload,
    token: randomUUID(),
    createdAt: new Date().toISOString()
  };

  if (sessionStorageMode === "redis") {
    const client = await getRedisClient();
    await client.set(`${sessionRedisPrefix}${session.token}`, JSON.stringify(session), {
      EX: sessionTtlSeconds
    });

    return session;
  }

  const store = await readStoredSessions();
  store[session.token] = encryptSession(session);
  await writeStoredSessions(store);

  return session;
}

export async function getSession(token: string): Promise<MailSession | undefined> {
  if (sessionStorageMode === "redis") {
    const client = await getRedisClient();
    const session = await client.get(`${sessionRedisPrefix}${token}`);

    return session ? (JSON.parse(session) as MailSession) : undefined;
  }

  const store = await readStoredSessions();
  const record = store[token];

  if (!record) {
    return undefined;
  }

  return decryptSession(record);
}

export async function deleteSession(token: string): Promise<void> {
  if (sessionStorageMode === "redis") {
    const client = await getRedisClient();
    await client.del(`${sessionRedisPrefix}${token}`);
    return;
  }

  const store = await readStoredSessions();

  if (!store[token]) {
    return;
  }

  delete store[token];
  await writeStoredSessions(store);
}