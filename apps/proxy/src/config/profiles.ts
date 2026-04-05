export type MailPresetKey = "EXTERNAL" | "INTERNAL";

export type MailConnectionPreset = {
  key: MailPresetKey;
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

function loadMailPresets(): MailConnectionPreset[] {
  const raw = process.env.MAIL_PRESETS_JSON;
  if (!raw) {
    throw new Error(
      "MAIL_PRESETS_JSON environment variable is required. " +
        "Set it to a JSON array of MailConnectionPreset objects in your .env file."
    );
  }
  try {
    return JSON.parse(raw) as MailConnectionPreset[];
  } catch {
    throw new Error("MAIL_PRESETS_JSON contains invalid JSON.");
  }
}

export const mailPresets: MailConnectionPreset[] = loadMailPresets();

function findPresetByMailHost(host: string): MailConnectionPreset | undefined {
  const expectedHost = host.toLowerCase();
  return mailPresets.find(
    (preset) => preset.imap.host.toLowerCase() === expectedHost || preset.smtp.host.toLowerCase() === expectedHost
  );
}

export function detectPresetByEmail(email: string): MailConnectionPreset {
  const domain = email.split("@").at(1)?.toLowerCase() ?? "";

  if (domain === "citricloud.com") {
    return findPresetByMailHost("mail.citricloud.com") ?? mailPresets[0];
  }

  if (domain.endsWith(".citricloud.com")) {
    return findPresetByMailHost("ems.citricloud.com") ?? mailPresets[0];
  }

  const exactMatch = mailPresets.find((preset) => domain === preset.domainSuffix);

  if (exactMatch) {
    return exactMatch;
  }

  const suffixMatch = mailPresets.find((preset) => domain.endsWith(preset.domainSuffix));

  return suffixMatch ?? mailPresets[0];
}

export function getPresetByKey(key?: string): MailConnectionPreset {
  if (!key) {
    return mailPresets[0];
  }

  return mailPresets.find((preset) => preset.key === key) ?? mailPresets[0];
}