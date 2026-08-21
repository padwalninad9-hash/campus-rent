import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Check, CircleAlert, LoaderCircle, MailCheck, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

function readAuthError() {
  const params = new URLSearchParams(`${window.location.search}&${window.location.hash.slice(1)}`);
  return params.get("error_description") || params.get("error");
}

export default function EmailConfirmed() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const authError = readAuthError();
    if (authError) {
      setMessage(authError.replace(/\+/g, " "));
      setStatus("error");
      return;
    }

    async function checkConfirmation() {
      // Supabase consumes the confirmation token on arrival and creates a session.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setStatus("success");
        // Email confirmation creates a Supabase session. Take the new member
        // directly to their signed-in Rentify home after a short confirmation.
        setTimeout(() => navigate("/", { replace: true }), 1100);
      } else {
        setStatus("error");
        setMessage("This confirmation link is invalid, expired, or has already been used.");
      }
    }
    const timer = setTimeout(checkConfirmation, 250);
    return () => clearTimeout(timer);
  }, []);

  const success = status === "success";
  return <div className="auth-page-wrap"><div className="auth-card auth-card-wide text-center">
    <div className={`auth-icon ${success ? "auth-icon-success" : status === "error" ? "auth-icon-error" : ""}`}>
      {status === "checking" ? <LoaderCircle className="animate-spin" /> : success ? <Check /> : <CircleAlert />}
    </div>
    {status === "checking" && <><p className="section-kicker mt-5">Securing your account</p><h1 className="font-display text-2xl font-bold">Confirming your email…</h1><p className="mt-3 text-sm text-slate-500">Just a moment while we verify your link.</p></>}
    {success && <><p className="section-kicker mt-5">You’re all set</p><h1 className="font-display text-3xl font-bold">Welcome to Rentify</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">Your email is confirmed. Logging you in now…</p><div className="auth-perks"><span><MailCheck size={16} /> Verified email</span><span><ShieldCheck size={16} /> Account secured</span></div></>}
    {status === "error" && <><p className="section-kicker mt-5">Link unavailable</p><h1 className="font-display text-2xl font-bold">We couldn’t confirm your email</h1><p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-slate-500">{message}</p><div className="mt-7 flex flex-wrap justify-center gap-3"><Link className="btn-primary" to="/signup">Create account</Link><Link className="btn-outline" to="/login">Log in</Link></div></>}
  </div></div>;
}
