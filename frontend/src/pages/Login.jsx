import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, MapPin, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const { error: loginError } = await signIn(email, password);
    setLoading(false);
    if (loginError) setError(loginError.message);
    else navigate("/");
  }

  return <section className="login-shell">
    <div className="login-grain" /><div className="login-orb login-orb-one" /><div className="login-orb login-orb-two" />
    <div className="login-layout">
      <main className="login-form-wrap">
        <div className="login-brandline"><span className="brand-mark">R</span><b>rent<span>ify</span></b></div>
        <div className="login-card">
          <div className="login-card-top"><span className="login-icon"><LockKeyhole size={23} /></span><span className="login-live"><i /> Secure sign in</span></div>
          <p className="section-kicker mt-7">Welcome back</p>
          <h1>Pick up where you left off.</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Your rental marketplace is ready when you are.</p>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {location.state?.message && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{location.state.message}</p>}
            <label className="form-label">Email address<div className="input-with-icon"><Mail size={18} /><input type="email" required autoComplete="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label>
            <label className="form-label">Password<div className="password-field input-with-icon"><LockKeyhole size={18} /><input type={showPassword ? "text" : "password"} required autoComplete="current-password" placeholder="Enter your password" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
            <div className="flex justify-end"><Link to="/forgot-password" className="text-sm font-bold text-indigo-600 hover:text-indigo-800">Forgot password?</Link></div>
            {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
            <button className="btn-primary login-submit w-full" disabled={loading}>{loading ? "Logging you in…" : <>Enter Rentify <ArrowRight size={18} /></>}</button>
          </form>
          <div className="login-divider"><span>New to Rentify?</span></div>
          <Link to="/signup" className="login-create-link">Create an account <ArrowRight size={17} /></Link>
        </div>
        <p className="login-footer">Your privacy matters. Your password is always protected.</p>
      </main>

      <aside className="login-showcase">
        <div className="showcase-copy"><div className="signup-badge"><Sparkles size={15} /> Your world, in motion</div><h2>Find the things that make today <span>possible.</span></h2><p>From the must-haves to the nice-to-haves, Rentify keeps everyday life moving.</p></div>
        <div className="login-visual">
          <div className="visual-ticket"><div className="ticket-meta"><span>Discover nearby</span><span>✦ RENTIFY</span></div><div className="ticket-art">🎒<span>📚</span><i>🎧</i></div><div className="ticket-bottom"><div><b>Ready for anything</b><small>Borrow • Create • Explore</small></div><span className="ticket-arrow">↗</span></div></div>
          <div className="login-float login-float-one"><MapPin size={17} /><span><b>Right nearby</b><small>Rental community</small></span></div>
          <div className="login-float login-float-two"><span className="float-spark">✦</span><span><b>Always useful</b><small>Rent what you need</small></span></div>
        </div>
        <div className="login-social-proof"><div className="quote-avatars"><i>S</i><i>R</i><i>M</i></div><p>Made for people who do more with less.</p></div>
      </aside>
    </div>
  </section>;
}
