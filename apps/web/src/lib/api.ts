export type ConnectionProfile = {
  key: "EXTERNAL" | "INTERNAL";
  label: string;
  environment: string;
  domainSuffix: string;
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
};

export type AuthSession = {
  token: string;
  email: string;
  role: "admin" | "user";
  presetKey: string;
  createdAt: string;
};

export type MailFolder = {
  path: string;
  name: string;
  specialUse: string | null;
};

export type MessagePreview = {
  uid: number;
  subject: string;
  from: string;
  date: string | null;
  preview: string;
  unread: boolean;
  flagged: boolean;
};

export type MessageDetail = {
  uid: number;
  subject: string;
  from: string;
  to: string;
  cc: string | null;
  replyTo: string[];
  messageId: string | null;
  references: string[];
  date: string | null;
  text: string;
  html: string | null;
  unread: boolean;
};

export type SendMessagePayload = {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  inReplyTo?: string;
  references?: string[];
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    },
    ...init
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({ error: "Request failed." }))) as { error?: string };
    throw new Error(payload.error ?? "Request failed.");
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getProfiles() {
  return request<{ profiles: ConnectionProfile[] }>("/api/setup/profiles");
}

export function detectProfile(email: string, preferredPresetKey?: string) {
  return request<{ profile: ConnectionProfile }>("/api/setup/detect", {
    method: "POST",
    body: JSON.stringify({ email, preferredPresetKey })
  });
}

export function login(payload: {
  email: string;
  password: string;
  presetKey?: string;
  imap?: ConnectionProfile["imap"];
  smtp?: ConnectionProfile["smtp"];
}) {
  return request<{ session: AuthSession; folders: MailFolder[] }>("/api/session/login", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function logout(token: string) {
  return request<void>("/api/session/logout", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function getFolders(token: string) {
  return request<{ folders: MailFolder[] }>("/api/messages/folders", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function getMessages(token: string, folder: string) {
  return request<{ messages: MessagePreview[] }>(`/api/messages?folder=${encodeURIComponent(folder)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function getMessage(token: string, folder: string, uid: number) {
  return request<{ message: MessageDetail }>(`/api/messages/${uid}?folder=${encodeURIComponent(folder)}`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function deleteMessage(token: string, folder: string, uid: number) {
  return request<void>("/api/messages/delete", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ folder, uid })
  });
}

export function moveMessage(token: string, folder: string, uid: number, destination: string) {
  return request<void>("/api/messages/move", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ folder, uid, destination })
  });
}

export function sendMessage(token: string, payload: SendMessagePayload) {
  return request<{ status: string }>("/api/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });
}