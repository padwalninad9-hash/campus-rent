import { useState } from "react";
import { FaDiscord, FaGithub, FaGoogle, FaLinkedin, FaMeta, FaXTwitter } from "react-icons/fa6";
import { useAuth } from "../context/AuthContext";

const PROVIDERS = [
  { key: "google", label: "Google", Icon: FaGoogle },
  { key: "github", label: "GitHub", Icon: FaGithub },
  { key: "discord", label: "Discord", Icon: FaDiscord },
  { key: "facebook", label: "Facebook", Icon: FaMeta },
  { key: "twitter", label: "X", Icon: FaXTwitter },
  { key: "linkedin_oidc", label: "LinkedIn", Icon: FaLinkedin },
];

export default function SocialLoginButtons() {
  const { signInWithProvider } = useAuth();
  const [loadingProvider, setLoadingProvider] = useState("");
  const [error, setError] = useState("");

  async function handleClick(providerKey) {
    setError("");
    setLoadingProvider(providerKey);
    const { error: providerError } = await signInWithProvider(providerKey);
    // On success the browser navigates away to the provider immediately —
    // this only runs if the redirect itself failed to start.
    if (providerError) {
      setError(providerError.message);
      setLoadingProvider("");
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2.5">
        {PROVIDERS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => handleClick(key)}
            disabled={!!loadingProvider}
            aria-label={`Continue with ${label}`}
            title={`Continue with ${label}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-60"
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-center text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}
