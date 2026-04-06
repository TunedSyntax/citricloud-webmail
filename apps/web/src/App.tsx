import { useEffect, useState } from "react";

import { AccessPolicyPage } from "./components/AccessPolicyPage";
import { AccountSetupWizard } from "./components/AccountSetupWizard";
import { MailDashboard } from "./components/MailDashboard";
import { WebmailIntroPage } from "./components/WebmailIntroPage";
import { getFolders, type AuthSession, type MailFolder } from "./lib/api";

type AuthState = {
  session: AuthSession;
  folders: MailFolder[];
} | null;

export type SavedAccount = {
  session: AuthSession;
  folders: MailFolder[];
};

const savedAccountsStorageKey = "citricloud-webmail.saved-accounts";
const activeAccountStorageKey = "citricloud-webmail.active-account-token";

function readSavedAccounts(): SavedAccount[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(savedAccountsStorageKey);
    if (!raw) {
      return [];
    }

    return JSON.parse(raw) as SavedAccount[];
  } catch {
    return [];
  }
}

function writeSavedAccounts(accounts: SavedAccount[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(savedAccountsStorageKey, JSON.stringify(accounts));
}

function readActiveAccountToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(activeAccountStorageKey);
}

function writeActiveAccountToken(token: string | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!token) {
    window.localStorage.removeItem(activeAccountStorageKey);
    return;
  }

  window.localStorage.setItem(activeAccountStorageKey, token);
}

function upsertSavedAccount(accounts: SavedAccount[], nextAccount: SavedAccount) {
  const remaining = accounts.filter((account) => account.session.token !== nextAccount.session.token);
  return [nextAccount, ...remaining].sort(
    (left, right) => Date.parse(right.session.createdAt) - Date.parse(left.session.createdAt)
  );
}

export default function App() {
  const [authState, setAuthState] = useState<AuthState>(null);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isRestoringAccount, setIsRestoringAccount] = useState(true);
  const [lastActiveToken, setLastActiveToken] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [showIntroPage, setShowIntroPage] = useState(true);
  const [showAccessPolicyPage, setShowAccessPolicyPage] = useState(false);

  useEffect(() => {
    const storedAccounts = readSavedAccounts();
    const activeToken = readActiveAccountToken();
    setLastActiveToken(activeToken);

    if (!storedAccounts.length) {
      setSavedAccounts([]);
      writeActiveAccountToken(null);
      setIsRestoringAccount(false);
      return;
    }

    void (async () => {
      const validationResults = await Promise.allSettled(
        storedAccounts.map(async (account) => {
          const response = await getFolders(account.session.token);
          return {
            session: account.session,
            folders: response.folders
          } satisfies SavedAccount;
        })
      );

      const activeAccounts = validationResults
        .filter((result): result is PromiseFulfilledResult<SavedAccount> => result.status === "fulfilled")
        .map((result) => result.value)
        .sort((left, right) => Date.parse(right.session.createdAt) - Date.parse(left.session.createdAt));

      if (!activeAccounts.length) {
        const fallbackAccounts = [...storedAccounts].sort(
          (left, right) => Date.parse(right.session.createdAt) - Date.parse(left.session.createdAt)
        );

        setSavedAccounts(fallbackAccounts);
        writeSavedAccounts(fallbackAccounts);
        writeActiveAccountToken(null);
        setRestoreError("Unable to validate saved sessions right now. You can still try Resume.");
        setIsRestoringAccount(false);
        return;
      }

      setSavedAccounts(activeAccounts);
      writeSavedAccounts(activeAccounts);
      writeActiveAccountToken(null);

      if (validationResults.some((result) => result.status === "rejected")) {
        setRestoreError("One or more saved sessions expired and were removed.");
      } else {
        setRestoreError(null);
      }

      setIsRestoringAccount(false);
    })();
  }, []);

  async function resumeSavedAccount(token: string, sourceAccounts = savedAccounts) {
    const matchingAccount = sourceAccounts.find((account) => account.session.token === token);

    if (!matchingAccount) {
      setRestoreError("Saved session not found.");
      setIsRestoringAccount(false);
      return;
    }

    setIsRestoringAccount(true);
    setRestoreError(null);

    try {
      const response = await getFolders(token);
      const refreshedAccount = {
        session: matchingAccount.session,
        folders: response.folders
      } satisfies SavedAccount;
      const nextAccounts = upsertSavedAccount(sourceAccounts, refreshedAccount);

      setSavedAccounts(nextAccounts);
      writeSavedAccounts(nextAccounts);
      writeActiveAccountToken(token);
      setAuthState(refreshedAccount);
    } catch {
      const nextAccounts = sourceAccounts.filter((account) => account.session.token !== token);
      setSavedAccounts(nextAccounts);
      writeSavedAccounts(nextAccounts);
      writeActiveAccountToken(null);
      setAuthState(null);
      setRestoreError("Saved session expired or is no longer valid.");
    } finally {
      setIsRestoringAccount(false);
    }
  }

  const handleAuthenticated = (payload: { session: AuthSession; folders: MailFolder[] }) => {
    const nextAccount = {
      session: payload.session,
      folders: payload.folders
    } satisfies SavedAccount;
    const nextAccounts = upsertSavedAccount(savedAccounts, nextAccount);

    setAuthState(nextAccount);
    setSavedAccounts(nextAccounts);
    writeSavedAccounts(nextAccounts);
    writeActiveAccountToken(payload.session.token);
    setLastActiveToken(payload.session.token);
    setRestoreError(null);
    setShowIntroPage(false);
  };

  const handleSignedOut = (token: string) => {
    const nextAccounts = savedAccounts.filter((account) => account.session.token !== token);

    setAuthState((current) => (current?.session.token === token ? null : current));
    setSavedAccounts(nextAccounts);
    writeSavedAccounts(nextAccounts);

    if (readActiveAccountToken() === token) {
      writeActiveAccountToken(null);
    }

    if (lastActiveToken === token) {
      setLastActiveToken(nextAccounts[0]?.session.token ?? null);
    }

    setShowIntroPage(true);
    setShowAccessPolicyPage(false);
  };

  const handleAddAccount = () => {
    writeActiveAccountToken(null);
    setAuthState(null);
    setRestoreError(null);
    setShowIntroPage(true);
    setShowAccessPolicyPage(false);
  };

  const isLoggedIn = Boolean(authState);

  return (
    <main
      className={`min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),linear-gradient(180deg,#eff5fc_0%,#dce9f9_42%,#eef4fc_100%)] text-surface-900 ${
        isLoggedIn ? "h-screen overflow-hidden" : "h-screen overflow-hidden"
      }`}
    >
      <div className="h-full w-full">
        {isRestoringAccount ? (
          <section className="rounded-[32px] border border-white/60 bg-white/80 p-10 text-center shadow-glow backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">CitriCloud Mail Console</p>
            <h1 className="mt-3 text-3xl font-semibold text-surface-900">Restoring saved session</h1>
            <p className="mt-3 text-sm text-surface-600">Validating the last active account against the proxy.</p>
          </section>
        ) : authState ? (
          <MailDashboard
            initialFolders={authState.folders}
            onAddAccount={handleAddAccount}
            onResumeAccount={(token) => {
              void resumeSavedAccount(token);
            }}
            onSignedOut={handleSignedOut}
            savedAccounts={savedAccounts}
            session={authState.session}
          />
        ) : showIntroPage ? (
          <WebmailIntroPage
            onContinue={() => {
              setShowIntroPage(false);
              setShowAccessPolicyPage(true);
            }}
          />
        ) : showAccessPolicyPage ? (
          <AccessPolicyPage
            onContinue={() => {
              setShowAccessPolicyPage(false);
            }}
          />
        ) : (
          <AccountSetupWizard
            lastActiveToken={lastActiveToken}
            onAuthenticated={handleAuthenticated}
            onResumeAccount={(token) => {
              void resumeSavedAccount(token);
            }}
            recentAccounts={savedAccounts}
            restoreError={restoreError}
          />
        )}
      </div>
    </main>
  );
}