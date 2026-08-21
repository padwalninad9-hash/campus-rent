import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  async function loadProfile(userId) {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data);
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authCode = params.get("code");
    const isRecoveryRedirect = window.location.pathname === "/reset-password" &&
      (authCode || window.location.hash.includes("type=recovery"));

    async function initializeAuth() {
      // Supabase's PKCE emails carry a ?code= parameter. Exchange it before
      // reading the session, otherwise the reset form has no recovery session.
      if (authCode) await supabase.auth.exchangeCodeForSession(authCode);
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) loadProfile(session.user.id);
      if (isRecoveryRedirect && session?.user) setIsPasswordRecovery(true);
      setLoading(false);
    }
    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase fires this when someone lands on the app via a password-reset
      // email link — it logs them into a temporary session just for that.
      // We flag it so the app can show "set a new password" instead of
      // treating it like a normal login.
      if (event === "PASSWORD_RECOVERY") setIsPasswordRecovery(true);
      if (event === "SIGNED_OUT") setIsPasswordRecovery(false);

      setSession(session);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signUp(email, password, fullName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // This must be listed in Supabase Auth → URL Configuration → Redirect URLs.
        emailRedirectTo: `${window.location.origin}/auth/confirmed`,
      },
    });
    return { error };
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsPasswordRecovery(false);
    return { error };
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    isPasswordRecovery,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    refreshProfile: () => session?.user && loadProfile(session.user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
