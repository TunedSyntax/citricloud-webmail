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
  folder: string;
  subject: string;
  from: string;
  date: string | null;
  preview: string;
  unread: boolean;
  flagged: boolean;
  hasAttachments: boolean;
};

export type MessageAttachment = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  contentBase64: string;
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
  attachments: MessageAttachment[];
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

export type EnvironmentVersions = {
  dev: string;
  staging: string;
  prod: string;
};

async function request<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(input, {
    ...init,
    headers
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

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "x-session-token": token
  };
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
    headers: authHeaders(token)
  });
}

export function getFolders(token: string) {
  return request<{ folders: MailFolder[] }>("/api/messages/folders", {
    headers: authHeaders(token)
  });
}

export function getMessages(token: string, folder: string) {
  return request<{ messages: MessagePreview[] }>(`/api/messages?folder=${encodeURIComponent(folder)}`, {
    headers: authHeaders(token)
  });
}

export function getMessage(token: string, folder: string, uid: number) {
  return request<{ message: MessageDetail }>(`/api/messages/${uid}?folder=${encodeURIComponent(folder)}`, {
    headers: authHeaders(token)
  });
}

export function deleteMessage(token: string, folder: string, uid: number) {
  return request<void>("/api/messages/delete", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ folder, uid })
  });
}

export function moveMessage(token: string, folder: string, uid: number, destination: string) {
  return request<void>("/api/messages/move", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ folder, uid, destination })
  });
}

export function updateMessageFlags(token: string, payload: { folder: string; uid: number; unread?: boolean; flagged?: boolean }) {
  return request<void>("/api/messages/flags", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });
}

export function sendMessage(token: string, payload: SendMessagePayload) {
  return request<{ status: string }>("/api/messages/send", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload)
  });
}

type GithubRelease = {
  tag_name: string;
  prerelease: boolean;
};

type GithubWorkflowRun = {
  head_sha: string;
};

type GithubWorkflowRunsResponse = {
  workflow_runs: GithubWorkflowRun[];
};

export async function getEnvironmentVersions(): Promise<EnvironmentVersions> {
  const baseUrl = "https://api.github.com/repos/TunedSyntax/citricloud-webmail";
  const headers = {
    Accept: "application/vnd.github+json"
  };

  const [releaseResponse, workflowResponse] = await Promise.all([
    fetch(`${baseUrl}/releases?per_page=50`, { headers }),
    fetch(`${baseUrl}/actions/workflows/deploy.yml/runs?branch=dev&status=success&per_page=1`, { headers })
  ]);

  const releases: GithubRelease[] = releaseResponse.ok ? ((await releaseResponse.json()) as GithubRelease[]) : [];
  const workflowRuns: GithubWorkflowRunsResponse | null = workflowResponse.ok
    ? ((await workflowResponse.json()) as GithubWorkflowRunsResponse)
    : null;

  const latestStable = releases.find((release) => !release.prerelease)?.tag_name ?? "Unavailable";
  const latestPrerelease = releases.find((release) => release.prerelease)?.tag_name ?? "Unavailable";
  const latestDevSha = workflowRuns?.workflow_runs?.[0]?.head_sha;

  return {
    dev: latestDevSha ? `dev-${latestDevSha.slice(0, 7)}` : "Unavailable",
    staging: latestPrerelease,
    prod: latestStable
  };
}