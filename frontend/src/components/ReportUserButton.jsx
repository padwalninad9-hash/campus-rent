import { useState } from "react";
import { CheckCircle2, Flag, Loader2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function ReportUserButton({ reportedUserId }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  if (!user || user.id === reportedUserId) return null;

  async function submit(event) {
    event.preventDefault();
    if (!reason.trim()) return;
    setSubmitting(true);
    setError("");
    const { error: insertError } = await supabase
      .from("user_reports")
      .insert({ reporter_id: user.id, reported_user_id: reportedUserId, reason: reason.trim() });
    setSubmitting(false);
    if (insertError) setError(insertError.message);
    else setDone(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 transition hover:text-rose-600"
      >
        <Flag size={13} /> Report
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/60 p-5 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold text-slate-900">Report this member</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
            </div>
            {done ? (
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <CheckCircle2 size={18} /> Thanks — this has been reported.
              </div>
            ) : (
              <form onSubmit={submit} className="mt-3">
                <p className="text-sm text-slate-500">Tell us what happened. Our team reviews reports and factors them into member trust scores.</p>
                <textarea
                  required
                  minLength={10}
                  maxLength={500}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="e.g. Item didn't match the listing description…"
                  className="mt-3 min-h-[6rem] w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
                {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Flag size={16} />}
                  Submit report
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
