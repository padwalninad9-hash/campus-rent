import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Mail, ShieldCheck, Sparkles, User } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import PasswordStrength, { isStrongPassword } from "../components/PasswordStrength";

export default function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    if (!isStrongPassword(password)) return setError("Please choose a stronger password that meets all requirements.");
    setLoading(true);
    const { error: signupError } = await signUp(email, password, fullName);
    setLoading(false);
    if (signupError) setError(signupError.message);
    else navigate(`/verify-email-sent?email=${encodeURIComponent(email)}`);
  }

  return <section className="signup-shell">
    <div className="signup-glow signup-glow-one" /><div className="signup-glow signup-glow-two" />
    <div className="signup-layout">
      <aside className="signup-story">
        <div className="signup-story-content">
          <div className="signup-badge"><Sparkles size={15} /> Rent smarter, live lighter</div>
          <h1>More living. <span>Less buying.</span></h1>
          <p>Join a trusted community where the things you need are always closer than you think.</p>
          <div className="signup-benefits">
            <div><span><CheckCircle2 size={18} /></span><p><b>Made for everyone</b><small>Useful things from people nearby.</small></p></div>
            <div><span><ShieldCheck size={18} /></span><p><b>Simple and secure</b><small>Your account is protected from day one.</small></p></div>
          </div>
        </div>
        <div className="signup-quote"><div className="quote-avatars"><i>N</i><i>A</i><i>R</i></div><p>“I found what I needed in minutes.”</p><span>— Rentify community</span></div>
      </aside>

      <main className="signup-form-wrap">
        <div className="signup-form-card">
          <div className="flex items-start justify-between gap-4"><div><p className="section-kicker">Get started</p><h2>Create your account</h2><p className="mt-2 text-sm text-slate-500">It takes less than a minute to join Rentify.</p></div><span className="signup-step">1 of 2</span></div>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <label className="form-label">Full name<div className="input-with-icon"><User size={18} /><input required autoComplete="name" placeholder="Your full name" value={fullName} onChange={(event) => setFullName(event.target.value)} /></div></label>
            <label className="form-label">Email address<div className="input-with-icon"><Mail size={18} /><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>
            <label className="form-label">Create password<div className="password-field input-with-icon"><ShieldCheck size={18} /><input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" placeholder="Create a strong password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
            <PasswordStrength password={password} />
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
            <button className="btn-primary signup-submit w-full" disabled={loading}>{loading ? "Creating your account…" : <>Continue <ArrowRight size={18} /></>}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="font-bold text-indigo-600 hover:text-indigo-800">Log in</Link></p>
          <p className="signup-legal">By continuing, you agree to use Rentify respectfully within the rental community.</p>
        </div>
      </main>
    </div>
  </section>;
}
