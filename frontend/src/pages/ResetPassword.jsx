import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";
import PasswordStrength, { isStrongPassword } from "../components/PasswordStrength";

export default function ResetPassword() {
  const { isPasswordRecovery, updatePassword, loading, signOut, user } = useAuth();
  const navigate = useNavigate();

  const [hasRecoveryToken] = useState(() => window.location.hash.includes("type=recovery") || new URLSearchParams(window.location.search).has("code"));

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!isStrongPassword(password)) return setError("Please choose a stronger password that meets all requirements.");
    if (password !== confirm) return setError("Passwords don't match.");

    setSubmitting(true);
    const { error } = await updatePassword(password);
    setSubmitting(false);

    if (error) {
      setError(error.message);
      return;
    }
    await signOut();
    navigate("/login", {
      replace: true,
      state: { message: "Your password was updated. Please log in with your new password." },
    });
  }

  if (!loading && (!hasRecoveryToken || !isPasswordRecovery || !user)) {
    return (
      <div className="max-w-sm mx-auto px-5 py-24 text-center">
        <p className="text-3xl mb-3">⚠️</p>
        <h1 className="font-display font-bold text-xl mb-2">Invalid or expired link</h1>
        <p className="text-ink/60 text-sm">
          Password reset links only work once and expire after a while. Request a fresh one.
        </p>
        <Link to="/forgot-password" className="btn-outline inline-block mt-6">
          Send a new link
        </Link>
      </div>
    );
  }

  if (loading) {
    return <p className="text-center py-24 font-mono text-sm text-ink/50">Verifying your link…</p>;
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-20">
      <div className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-indigo-100/40">
      <p className="section-kicker">One last step</p>
      <h1 className="font-display font-bold text-2xl mb-1">Create a new password</h1>
      <p className="text-ink/50 text-sm mb-7">Create a strong password, then confirm it below.</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="password-field">
          <input
            type={showPassword ? "text" : "password"}
            required
            minLength={8}
            placeholder="New password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide new password" : "Show new password"}>
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        <PasswordStrength password={password} />
        <div className="password-field">
          <input
            type={showConfirm ? "text" : "password"}
            required
            placeholder="Confirm new password"
            className="input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          <button type="button" className="password-toggle" onClick={() => setShowConfirm(!showConfirm)} aria-label={showConfirm ? "Hide confirmed password" : "Show confirmed password"}>
            {showConfirm ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        {error && <p className="text-stamp text-sm">{error}</p>}
        <button className="btn-primary w-full" disabled={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
      </div>
    </div>
  );
}
