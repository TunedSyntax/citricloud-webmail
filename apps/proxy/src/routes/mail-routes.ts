import type { Request, Response } from "express";
import { Router } from "express";
import { z } from "zod";

import { detectPresetByEmail, getPresetByKey, mailPresets } from "../config/profiles.js";
import {
  createFolder,
  deleteMessage,
  deleteFolder,
  getMessage,
  listFolders,
  listMessages,
  listStarredMessages,
  moveMessagesBatch,
  moveMessage,
  saveDraftMessage,
  sendMessage,
  updateMessageFlags,
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

const moveBatchSchema = z.object({
  items: z.array(
    z.object({
      folder: z.string().min(1),
      uid: z.number().int().positive()
    })
  ).min(1),
  destination: z.string().min(1)
});

const deleteSchema = z.object({
  folder: z.string().min(1),
  uid: z.number().int().positive()
});

const flagSchema = z.object({
  folder: z.string().min(1),
  uid: z.number().int().positive(),
  unread: z.boolean().optional(),
  flagged: z.boolean().optional()
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

const folderSchema = z.object({
  folder: z.string().min(1)
});

const saveDraftSchema = z.object({
  folder: z.string().min(1),
  to: z.array(z.string().email()).optional(),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  subject: z.string().optional(),
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

function handleRouteError(error: unknown, response: Response) {
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
    const detectedPreset = payload.presetKey ? getPresetByKey(payload.presetKey) : detectPresetByEmail(payload.email);
    const loginCandidate = {
      email: payload.email,
      password: payload.password,
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

     if (folder === "__STARRED__") {
      const folders = await listFolders(session);
      const messages = await listStarredMessages(session, folders, Number.isNaN(limit) ? 50 : limit);
      response.json({ messages });
      return;
    }

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

router.post("/messages/move-batch", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = moveBatchSchema.parse(request.body);
    await moveMessagesBatch(session, payload.items, payload.destination);
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/delete", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = deleteSchema.parse(request.body);
    await deleteMessage(session, payload.folder, payload.uid);
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/flags", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = flagSchema.parse(request.body);
    await updateMessageFlags(session, payload.folder, payload.uid, {
      unread: payload.unread,
      flagged: payload.flagged
    });
    response.status(204).send();
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/folders/create", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = folderSchema.parse(request.body);
    await createFolder(session, payload.folder);
    response.status(201).json({ status: "created" });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/folders/delete", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = folderSchema.parse(request.body);
    await deleteFolder(session, payload.folder);
    response.status(200).json({ status: "deleted" });
  } catch (error) {
    handleRouteError(error, response);
  }
});

router.post("/messages/drafts/save", async (request, response) => {
  try {
    const session = await getAuthenticatedSession(request);
    const payload = saveDraftSchema.parse(request.body);
    await saveDraftMessage(session, payload);
    response.status(202).json({ status: "saved" });
  } catch (error) {
    handleRouteError(error, response);
  }
});

export default router;