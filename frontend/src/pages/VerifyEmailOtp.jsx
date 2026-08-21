import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Mail, RefreshCw, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmailOtp() {
  const { verifySignupOtp, resendSignupOtp, signOut } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const email = params.get("email") || "";
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function verify(event) {
    event.preventDefault();
    if (!email) return setError("Your email is missing. Please sign up again.");
    if (!/^\d{6}$/.test(code)) return setError("Enter the 6-digit code from your email.");
    setError("");
    setSubmitting(true);
    const { error: verifyError } = await verifySignupOtp(email, code);
    setSubmitting(false);
    if (verifyError) return setError(verifyError.message);
    await signOut();
    navigate("/login", { replace: true, state: { message: "Email verified! Your Rentify account is ready—log in to continue." } });
  }

  async function resend() {
    if (!email) return setError("Your email is missing. Please sign up again.");
    setResending(true);
    setError("");
    const { error: resendError } = await resendSignupOtp(email);
    setResending(false);
    if (resendError) return setError(resendError.message);
    setResent(true);
  }

  return <div className="auth-page-wrap"><div className="auth-card auth-card-wide text-center">
    <div className="auth-icon"><Mail size={28} /></div>
    <p className="section-kicker mt-5">Verify your email</p>
    <h1 className="font-display text-3xl font-bold tracking-tight">Enter your one-time code</h1>
    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">We sent a 6-digit code to <span className="font-semibold text-slate-700">{email || "your email"}</span>.</p>
    <form onSubmit={verify} className="mx-auto mt-7 max-w-sm">
      <label className="sr-only" htmlFor="otp">Six-digit verification code</label>
      <div className="relative"><KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-indigo-500" size={19} /><input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" className="otp-input" /></div>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <button className="btn-primary mt-5 w-full" disabled={submitting}>{submitting ? "Verifying…" : <><ShieldCheck size={17} /> Verify email</>}</button>
    </form>
    <p className="mt-6 text-sm text-slate-500">Didn’t receive a code?</p>
    <button onClick={resend} disabled={resending} className="mt-2 inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-800 disabled:opacity-60"><RefreshCw size={15} className={resending ? "animate-spin" : ""} />{resending ? "Sending…" : resent ? "New code sent" : "Resend code"}</button>
    <p className="mt-7 text-sm text-slate-500"><Link to="/signup" className="font-semibold text-slate-700 underline">Use a different email</Link></p>
  </div></div>;
}
