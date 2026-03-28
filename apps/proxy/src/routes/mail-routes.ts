import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { detectPresetByEmail, getPresetByKey, mailPresets } from "../config/profiles.js";
import { hasPermission, isDomainAllowed, resolveRole, type Permission, type UserRole } from "../config/rbac.js";
import {
  deleteMessage,
  getMessage,
  listFolders,
  listMessages,
  moveMessage,
  sendMessage,
  verifyMailAccess
} from "../services/mail-service.js";
import { createSession, deleteSession, getSession } from "../services/session-store.js";

const router = Router();

const connectionSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().positive(),
  secure: z.boolean()
});

const detectSchema = z.object({
  email: z.string().email(),
  preferredPresetKey: z.string().optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  presetKey: z.string().optional(),
  imap: connectionSchema.optional(),
  smtp: connectionSchema.optional()
});

const moveSchema = z.object({
  folder: z.string().min(1),
  destination: z.string().min(1),
  uid: z.number().int().positive()
});

const deleteSchema = z.object({
  folder: z.string().min(1),
  uid: z.number().int().positive()
});

const sendSchema = z.object({
  to: z.array(z.string().email()).min(1),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().min(1),
  text: z.string().optional(),
  html: z.string().optional(),
  inReplyTo: z.string().optional(),
  references: z.array(z.string()).optional()
});

async function getAuthenticatedSession(request: Request) {
  const headerToken = request.headers.authorization?.replace(/^Bearer\s+/i, "");
  const token = headerToken ?? request.headers["x-session-token"]?.toString();

  if (!token) {
    throw new Error("Missing session token.");
  }

  const session = await getSession(token);

  if (!session) {
    throw new Error("Session not found.");
  }

  return session;
}

class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

function requirePermission(role: UserRole, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new ForbiddenError();
  }
}

function handleRouteError(error: unknown, response: Response) {
  if (error instanceof ForbiddenError) {
    return response.status(403).json({ error: error.message });
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";
  return response.status(400).json({ error: message });
}

router.get("/health", (_request, response) => {
  response.json({ status: "ok", service: "citricloud-webmail-proxy" });
});

router.get("/setup/profiles", (_request, response) => {
  response.json({ profiles: mailPresets });
});

router.post("/setup/detect", (request, response) => {
  try {
    const payload = detectSchema.parse(request.body);
    const detected = payload.preferredPresetKey
      ? getPresetByKey(payload.preferredPresetKey)
      : detectPresetByEmail(payload.email);

    response.json({ profile: detected });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/session/login", async (request, response) => {
  try {
    const payload = loginSchema.parse(request.body);

    if (!isDomainAllowed(payload.email)) {
      return response.status(403).json({ error: "Your email domain is not permitted to access this service." });
    }

    const detectedPreset = payload.presetKey ? getPresetByKey(payload.presetKey) : detectPresetByEmail(payload.email);
    const role = resolveRole(payload.email);
    const loginCandidate = {
      email: payload.email,
      password: payload.password,
      role,
      presetKey: detectedPreset.key,
      imap: payload.imap ?? detectedPreset.imap,
      smtp: payload.smtp ?? detectedPreset.smtp
    };

    await verifyMailAccess(loginCandidate);
    const session = await createSession(loginCandidate);
    const folders = await listFolders(session);

    response.json({
      session: {
        token: session.token,
        email: session.email,
        role: session.role,
        presetKey: session.presetKey,
        createdAt: session.createdAt
      },
      folders
    });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/session/logout", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    await deleteSession(session.token);
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.get("/messages/folders", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const folders = await listFolders(session);
    response.json({ folders });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.get("/messages", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const folder = request.query.folder?.toString() ?? "INBOX";
    const limit = Number(request.query.limit ?? 25);
    const messages = await listMessages(session, folder, Number.isNaN(limit) ? 25 : limit);
    response.json({ messages });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.get("/messages/:uid", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const folder = request.query.folder?.toString() ?? "INBOX";
    const uid = Number(request.params.uid);
    const message = await getMessage(session, folder, uid);
    response.json({ message });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/send", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = sendSchema.parse(request.body);
    await sendMessage(session, payload);
    response.status(202).json({ status: "queued" });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/move", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = moveSchema.parse(request.body);
    await moveMessage(session, payload.folder, payload.uid, payload.destination);
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/delete", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    requirePermission(session.role, "messages:delete");
    const payload = deleteSchema.parse(request.body);
    await deleteMessage(session, payload.folder, payload.uid);
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

export default router;