import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Building2, Camera, Check, Edit3, Mail, Phone, ShieldCheck, Sparkles, Upload, UserRound, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [form, setForm] = useState({ full_name: "", phone: "", location: "" });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
  const [kycStatus, setKycStatus] = useState("not_started");
  const [error, setError] = useState("");
  const photoInputRef = useRef(null);

  useEffect(() => { if (profile) setForm({ full_name: profile.full_name || "", phone: profile.phone || "", location: profile.location || "" }); }, [profile]);
  useEffect(() => () => { if (photoPreview) URL.revokeObjectURL(photoPreview); }, [photoPreview]);
  useEffect(() => {
    function closeOnEscape(event) { if (event.key === "Escape") setPhotoViewerOpen(false); }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);
  useEffect(() => {
    async function loadKyc() { const { data } = await supabase.from("kyc_submissions").select("status").eq("user_id", user.id).maybeSingle(); setKycStatus(data?.status || "not_started"); }
    if (user) loadKyc();
  }, [user]);

  const initials = useMemo(() => (form.full_name || user?.email || "R").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), [form.full_name, user?.email]);
  const completion = kycStatus === "verified" ? 100 : kycStatus === "pending" ? 80 : 60;
  const verificationLabel = kycStatus === "verified" ? "Identity verified" : kycStatus === "pending" ? "Verification in review" : "Verification needed";
  const avatarUrl = photoPreview || profile?.avatar_url;

  function selectPhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError("");
    if (!file.type.startsWith("image/")) { setPhotoError("Please choose an image file."); return; }
    if (file.size > 5 * 1024 * 1024) { setPhotoError("Choose an image smaller than 5 MB."); return; }
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  async function handleSave(event) {
    event.preventDefault(); setLoading(true); setSaved(false); setError("");
    let avatarUrlToSave = profile?.avatar_url || null;
    if (photoFile) {
      const extension = photoFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, photoFile, { contentType: photoFile.type, upsert: false });
      if (uploadError) { setError(`Photo upload failed: ${uploadError.message}`); setLoading(false); return; }
      const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);
      avatarUrlToSave = data.publicUrl;
    }
    const { error: updateError } = await supabase.from("profiles").update({ ...form, avatar_url: avatarUrlToSave }).eq("id", user.id);
    if (updateError) setError(updateError.message); else { await refreshProfile(); setSaved(true); }
    setLoading(false);
  }

  return <section className="profile-shell"><div className="profile-grid" /><div className="profile-wrap">
    <header className="profile-hero"><div><div className="eyebrow"><Sparkles size={14} /> Account command center</div><h1>Your profile, <span>upgraded.</span></h1><p>Manage your identity, community status, and account essentials in one place.</p></div><div className="profile-user-chip"><Avatar src={avatarUrl} initials={initials} onClick={() => setPhotoViewerOpen(true)} /><div><b>{form.full_name || "Rentify member"}</b><small><Mail size={13} /> {user?.email}</small></div></div></header>
    <div className="profile-layout">
      <aside className="profile-sidebar"><div className="profile-identity"><Avatar src={avatarUrl} initials={initials} large onClick={() => setPhotoViewerOpen(true)} /><div><p className="text-xs font-bold uppercase tracking-[.15em] text-indigo-200">Rentify member</p><h2>{form.full_name || "Complete your profile"}</h2><p>{form.location || "Location not added yet"}</p></div></div><div className="profile-stats"><div><b>{profile?.rating_count || 0}</b><span>Reviews</span></div><div><b>{profile?.rating_count ? profile.rating_avg : "—"}</b><span>Rating</span></div><div><b>{completion}%</b><span>Trusted</span></div></div><div className="profile-security"><ShieldCheck size={19} /><div><b>Account security</b><span>Email verified and protected</span></div><Check size={16} /></div></aside>
      <main className="profile-main"><div className="profile-panel"><div className="profile-panel-heading"><div><p className="section-kicker">Identity profile</p><h2>Personal details</h2></div><span className="profile-edit-icon"><Edit3 size={17} /></span></div><form onSubmit={handleSave} className="mt-7 grid gap-5 sm:grid-cols-2"><div className="profile-photo-editor sm:col-span-2"><Avatar src={avatarUrl} initials={initials} large onClick={() => setPhotoViewerOpen(true)} /><div><b>Profile photo</b><p>Use a clear image so people can recognise you on Rentify.</p><input ref={photoInputRef} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={selectPhoto} /><button type="button" className="profile-photo-button" onClick={() => photoInputRef.current?.click()}><Upload size={16} /> {avatarUrl ? "Change photo" : "Upload photo"}</button><span>PNG, JPG or WebP · maximum 5 MB</span></div><Camera className="profile-photo-camera" size={21} /></div><label className="form-label sm:col-span-2">Full name<div className="input-with-icon"><UserRound size={18} /><input value={form.full_name} placeholder="Your full name" onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} /></div></label><label className="form-label">Phone number<div className="input-with-icon"><Phone size={18} /><input type="tel" placeholder="Add phone number" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></div></label><label className="form-label">City / area<div className="input-with-icon"><Building2 size={18} /><input placeholder="Your location" value={form.location} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} /></div></label>{(error || photoError) && <p className="sm:col-span-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error || photoError}</p>}<div className="sm:col-span-2 flex flex-wrap items-center gap-4"><button className="btn-primary" disabled={loading}>{loading ? "Saving changes…" : "Save profile changes"}</button>{saved && <span className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600"><Check size={16} /> Profile saved</span>}</div></form></div>
      <div className="profile-panel profile-verification"><div className="profile-panel-heading"><div><p className="section-kicker">Trust score</p><h2>Profile authentication</h2></div><span className={`profile-status ${kycStatus}`}><BadgeCheck size={16} /> {verificationLabel}</span></div><div className="profile-progress-row"><div className="profile-progress"><i style={{ width: `${completion}%` }} /></div><b>{completion}% complete</b></div><p className="mt-4 max-w-2xl text-sm leading-6 text-slate-500">{kycStatus === "verified" ? "Your identity has been verified. Your profile now carries a Verified status." : kycStatus === "pending" ? "Your documents are securely in review. We’ll update your status as soon as verification is complete." : "Complete verification with a valid photo ID and a selfie to unlock a Verified profile."}</p>{kycStatus === "not_started" && <Link to="/verify-identity" className="btn-primary mt-5">Complete verification</Link>}</div></main>
    </div>
  </div>{photoViewerOpen && avatarUrl && <div className="profile-photo-viewer" role="dialog" aria-modal="true" aria-label="Profile photo" onClick={() => setPhotoViewerOpen(false)}><button type="button" className="profile-photo-viewer-close" aria-label="Close photo" onClick={() => setPhotoViewerOpen(false)}><X size={22} /></button><div className="profile-photo-viewer-card" onClick={(event) => event.stopPropagation()}><img src={avatarUrl} alt={`${form.full_name || "Rentify member"} profile`} /><p>{form.full_name || "Rentify member"}</p></div></div>}</section>;
}

function Avatar({ src, initials, large = false, onClick }) {
  const className = `profile-avatar${large ? " profile-avatar-lg" : ""}`;
  return src ? <button type="button" className="profile-avatar-button" onClick={onClick} aria-label="Open profile photo"><img className={`${className} profile-avatar-image`} src={src} alt="Profile" /></button> : <span className={className}>{initials}</span>;
}
