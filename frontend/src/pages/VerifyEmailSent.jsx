import { Link, useSearchParams } from "react-router-dom";
import { MailCheck, ShieldCheck } from "lucide-react";

export default function VerifyEmailSent() {
  const [params] = useSearchParams();
  const email = params.get("email") || "your email address";

  return <div className="auth-page-wrap"><div className="auth-card auth-card-wide text-center">
    <div className="auth-icon auth-icon-success"><MailCheck size={28} /></div>
    <p className="section-kicker mt-5">Check your inbox</p>
    <h1 className="font-display text-3xl font-bold tracking-tight">Verify your email</h1>
    <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500 dark:text-slate-400">We sent a verification link to <span className="font-semibold text-slate-700 dark:text-slate-200">{email}</span>. Open the email and select <b>Confirm your email</b>.</p>
    <div className="auth-perks"><span><MailCheck size={16} /> One-click verification</span><span><ShieldCheck size={16} /> Secure account</span></div>
    <p className="mt-7 text-sm text-slate-500 dark:text-slate-400">Once verified, you’ll be logged in to Rentify automatically.</p>
    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Or <Link className="font-semibold text-indigo-600 hover:text-indigo-800" to={`/verify-email-otp?email=${encodeURIComponent(email)}`}>enter the 6-digit code</Link> from the same email instead.</p>
    <Link className="btn-outline mt-5" to="/login">Back to log in</Link>
  </div></div>;
}
