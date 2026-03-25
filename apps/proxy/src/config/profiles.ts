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

export const mailPresets: MailConnectionPreset[] = [
  {
    key: "EXTERNAL",
    label: "CitriCloud External",
    environment: "K3S-Prod",
    domainSuffix: "citricloud.com",
    imap: {
      host: "mail.citricloud.com",
      port: 993,
      secure: true
    },
    smtp: {
      host: "mail.citricloud.com",
      port: 587,
      secure: false
    }
  },
  {
    key: "INTERNAL",
    label: "CitriCloud Internal",
    environment: "K3S-Mgmt",
    domainSuffix: "subdomain.citricloud.com",
    imap: {
      host: "ems.citricloud.com",
      port: 993,
      secure: true
    },
    smtp: {
      host: "ems.citricloud.com",
      port: 587,
      secure: false
    }
  }
];

export function detectPresetByEmail(email: string): MailConnectionPreset {
  const domain = email.split("@").at(1)?.toLowerCase() ?? "";
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