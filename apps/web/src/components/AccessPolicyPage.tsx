import { ArrowRight, Lock, Mail, CheckCircle2, Users, Globe } from "lucide-react";
import logo from "../assets/logo.svg";

export interface AccessPolicyPageProps {
  onContinue: () => void;
}

export function AccessPolicyPage({ onContinue }: AccessPolicyPageProps) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-start bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.24),_transparent_30%),linear-gradient(180deg,#eff5fc_0%,#dce9f9_42%,#eef4fc_100%)] overflow-y-auto px-4 py-8">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <img src={logo} alt="CitriCloud" className="mx-auto mb-6 h-12 w-auto" />
          <h1 className="text-4xl font-bold text-surface-900">Access & Registration Policy</h1>
          <p className="mt-3 text-lg text-surface-600">
            Understand who can access CitriCloud Webmail and how to request access
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Internal Users Section */}
          <div className="border border-surface-200 bg-white/90 p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-brand-200 bg-brand-50">
                <Lock className="h-5 w-5 text-brand-700" />
              </div>
              <h2 className="text-2xl font-bold text-surface-900">Internal Access</h2>
            </div>

            <div className="mb-6 border-l-4 border-brand-200 bg-brand-50 p-4">
              <p className="text-sm font-semibold text-brand-700 uppercase tracking-wide">
                ✓ Authorized Roles
              </p>
            </div>

            <p className="mb-6 text-sm text-surface-700">
              Only high-permission roles within the CitriCloud organization have direct access to register and use the webmail:
            </p>

            <ul className="space-y-3 mb-8">
              {[
                "Developers",
                "Administrators",
                "Network Engineers",
                "Security & Operations Teams",
                "CTO & Platform Leadership"
              ].map((role) => (
                <li key={role} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-green-600" />
                  <span className="text-sm text-surface-700">{role}</span>
                </li>
              ))}
            </ul>

            <div className="border-t border-surface-200 pt-6">
              <p className="text-xs text-surface-600">
                <strong>Your access:</strong> If you've been granted credentials by an administrator, simply log in with your assigned email and password below.
              </p>
            </div>
          </div>

          {/* External Users Section */}
          <div className="border border-surface-200 bg-white/90 p-8 shadow-sm">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center border border-blue-200 bg-blue-50">
                <Globe className="h-5 w-5 text-blue-700" />
              </div>
              <h2 className="text-2xl font-bold text-surface-900">External Access</h2>
            </div>

            <div className="mb-6 border-l-4 border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">
                ℹ Request Required
              </p>
            </div>

            <p className="mb-6 text-sm text-surface-700">
              External users or partners who need access must submit a request through the CitriCloud registration portal:
            </p>

            <div className="space-y-4">
              <div className="border border-surface-150 bg-surface-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center border border-surface-300 rounded-full bg-surface-100 text-xs font-semibold text-surface-700">
                    1
                  </span>
                  <p className="font-semibold text-surface-900">Request Form at citricloud.com</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  Fill out the registration form with your details and use case
                </p>
              </div>

              <div className="border border-surface-150 bg-surface-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center border border-surface-300 rounded-full bg-surface-100 text-xs font-semibold text-surface-700">
                    2
                  </span>
                  <p className="font-semibold text-surface-900">Approval & Policies</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  Review and accept all required policies and terms of service
                </p>
              </div>

              <div className="border border-surface-150 bg-surface-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center border border-surface-300 rounded-full bg-surface-100 text-xs font-semibold text-surface-700">
                    3
                  </span>
                  <p className="font-semibold text-surface-900">Mailbox Creation</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  Our developers review and create your mailbox if approved
                </p>
              </div>

              <div className="border border-surface-150 bg-surface-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center border border-surface-300 rounded-full bg-surface-100 text-xs font-semibold text-surface-700">
                    4
                  </span>
                  <p className="font-semibold text-surface-900">Temporary Password Email</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  Receive a welcome email with your temporary password
                </p>
              </div>

              <div className="border border-green-150 bg-green-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <p className="font-semibold text-surface-900">First Login & Password Setup</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  On your first login, set your new permanent password to secure your account
                </p>
              </div>

              <div className="border border-blue-150 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Mail className="h-5 w-5 text-blue-600" />
                  <p className="font-semibold text-surface-900">Full Access Enabled</p>
                </div>
                <p className="ml-8 text-xs text-surface-600">
                  Use your external email and password to access the webmail anytime (auto-detected at login)
                </p>
              </div>
            </div>

            <div className="mt-6 border-t border-surface-200 pt-4">
              <p className="text-xs text-surface-600">
                <strong>Request access:</strong> Visit{" "}
                <a href="https://citricloud.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                  citricloud.com
                </a>{" "}
                to submit your registration request
              </p>
            </div>
          </div>
        </div>

        {/* Important Notice */}
        <div className="mt-8 border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mb-3 flex justify-center">
            <Users className="h-6 w-6 text-amber-600" />
          </div>
          <h3 className="mb-2 font-semibold text-amber-900">Already Have Access?</h3>
          <p className="text-sm text-amber-800">
            If you are a CitriCloud organization member with assigned credentials, proceed to login below with your email address and password. The system will automatically detect your account configuration.
          </p>
        </div>

        {/* Action Button */}
        <div className="mt-10 flex justify-center">
          <button
            onClick={onContinue}
            className="flex items-center gap-3 border border-brand-600 bg-brand-600 px-8 py-4 font-semibold text-white transition-all hover:border-brand-700 hover:bg-brand-700 active:scale-95"
          >
            <span>I Understand, Continue to Login</span>
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-surface-500">
          Access policies are enforced by CitriCloud administration and proxy authentication service.
        </p>
      </div>
    </div>
  );
}
