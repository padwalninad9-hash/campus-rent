import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, KeyRound, Mail, RefreshCw, ShieldCheck, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault(); setError(""); setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) { setError(error.message || "We couldn't send the reset email. Please try again."); return; }
    setSent(true);
  }

  return <main className="recovery-shell">
    <div className="recovery-grid" aria-hidden="true" /><div className="recovery-orb recovery-orb-one" aria-hidden="true" /><div className="recovery-orb recovery-orb-two" aria-hidden="true" />
    <section className="recovery-layout">
      <aside className="recovery-story">
        <Link to="/" className="recovery-brand"><span className="brand-mark">R</span><span>rent<span>ify</span></span></Link>
        <div className="recovery-story-copy"><span className="recovery-label"><ShieldCheck size={14} /> Secure account recovery</span><h1>Your account,<br /><span>back in your hands.</span></h1><p>Reset your password with a private, time-limited link — no support ticket required.</p></div>
        <div className="recovery-steps" aria-label="Password reset steps">
          <div className={sent ? "complete" : "current"}><i>{sent ? <Check size={14} /> : "1"}</i><span><b>Request a reset link</b><small>We send it to your inbox</small></span></div>
          <div className={sent ? "current" : ""}><i>2</i><span><b>Open your secure email</b><small>Use the link to continue</small></span></div>
          <div><i>3</i><span><b>Choose a new password</b><small>Then you’re ready to go</small></span></div>
        </div>
        <p className="recovery-note"><Sparkles size={15} /> Your password is never visible to Rentify.</p>
      </aside>
      <div className="recovery-content"><AnimatePresence mode="wait">{sent ? (
        <motion.div key="sent" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .36 }} className="recovery-card recovery-success-card">
          <div className="mail-illustration" aria-hidden="true"><div className="mail-spark spark-one">✦</div><div className="mail-spark spark-two">✦</div><div className="mail-envelope"><Mail size={34} strokeWidth={1.6} /><i><Check size={13} /></i></div></div>
          <p className="section-kicker">Email sent</p><h2>Check your inbox</h2><p className="recovery-body">If an account exists for <strong>{email}</strong>, we’ve sent a secure link to reset your password.</p><div className="recovery-email-chip"><Mail size={16} /><span>{email}</span></div>
          <div className="recovery-tip"><KeyRound size={17} /><p><b>What happens next?</b><span>Open the email and follow the link. It will bring you back here to choose a new password.</span></p></div>
          <div className="recovery-actions"><Link to="/login" className="btn-primary">Back to log in <ArrowRight size={17} /></Link><button onClick={() => { setSent(false); setError(""); }} className="recovery-text-button"><RefreshCw size={15} /> Use a different email</button></div><p className="recovery-help">Can’t find it? Check your spam or promotions folder.</p>
        </motion.div>
      ) : (
        <motion.div key="form" initial={{ opacity: 0, y: 16, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .36 }} className="recovery-card">
          <Link to="/login" className="recovery-back"><ArrowLeft size={16} /> Back to log in</Link><div className="recovery-icon"><KeyRound size={25} /></div><p className="section-kicker">Account recovery</p><h2>Reset your password</h2><p className="recovery-body">Enter the email linked to your account. We’ll send a secure reset link in a moment.</p>
          <form onSubmit={handleSubmit} className="recovery-form"><label htmlFor="recovery-email">Email address</label><div className="recovery-input"><Mail size={18} /><input id="recovery-email" type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>{error && <p className="recovery-error">{error}</p>}<button className="btn-primary recovery-submit" disabled={loading}>{loading ? <><RefreshCw className="animate-spin" size={17} /> Sending secure link…</> : <>Send reset link <ArrowRight size={17} /></>}</button></form>
          <div className="recovery-assurance"><ShieldCheck size={17} /><span><b>Private and protected</b> — we’ll never reveal whether an email has an account.</span></div>
        </motion.div>
      )}</AnimatePresence></div>
    </section>
  </main>;
}
