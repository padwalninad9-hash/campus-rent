import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const LEVEL_STYLES = {
  low: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  high: "bg-rose-50 text-rose-700",
};

const FACTOR_LABELS = {
  account_age: "Account age",
  email_verified: "Email verified",
  kyc_status: "Identity verification",
  booking_history: "Cancellation history",
  reports: "Reports against them",
  velocity: "Booking velocity (24h)",
  payment_failures: "Payment failures",
};

function FactorBreakdown({ factors }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {Object.entries(factors || {}).map(([key, value]) => (
        <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>{FACTOR_LABELS[key] || key}</span>
            <span>{value.points} / {value.max} pts</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, (value.points / value.max) * 100)}%` }} />
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500">
            {Object.entries(value).filter(([k]) => k !== "points" && k !== "max").map(([k, v]) => `${k}: ${v}`).join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}

function RiskTable({ rows, expandedId, onToggle }) {
  if (!rows.length) return <p className="p-6 text-sm text-slate-500">No users scored yet.</p>;
  return (
    <div className="divide-y divide-slate-100">
      {rows.map((row) => (
        <div key={row.user_id}>
          <button
            type="button"
            onClick={() => onToggle(row.user_id)}
            className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-slate-50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-slate-800">{row.profiles?.full_name || "Unnamed user"}</p>
              <p className="truncate text-xs text-slate-400">{row.profiles?.location || "No location on file"}</p>
            </div>
            <span className="text-sm font-mono font-bold text-slate-700">{Number(row.score).toFixed(0)}</span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${LEVEL_STYLES[row.risk_level]}`}>{row.risk_level}</span>
            <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${expandedId === row.user_id ? "rotate-180" : ""}`} />
          </button>
          {expandedId === row.user_id && (
            <div className="border-t border-slate-100 bg-white px-5 py-4">
              <FactorBreakdown factors={row.factors} />
              <p className="mt-3 text-[11px] text-slate-400">Last recalculated {new Date(row.updated_at).toLocaleString()}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminRisk() {
  const { session } = useAuth();
  const [scores, setScores] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [{ data: scoreData, error: scoreError }, { data: pendingData, error: pendingError }] = await Promise.all([
      supabase.from("user_risk_scores").select("*, profiles(full_name, location)").order("score", { ascending: false }),
      supabase
        .from("bookings")
        .select("*, items(title), renter:profiles!bookings_renter_id_fkey(full_name)")
        .eq("status", "pending_review")
        .order("created_at", { ascending: true }),
    ]);
    if (scoreError || pendingError) setError((scoreError || pendingError).message);
    setScores(scoreData || []);
    setPending(pendingData || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recalculateAll() {
    setRecalculating(true);
    setError("");
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recalculate-risk-scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Recalculation failed");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setRecalculating(false);
    }
  }

  async function resolveBooking(id, status) {
    setWorkingId(id);
    setError("");
    const { error: updateError } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (updateError) setError(updateError.message);
    await load();
    setWorkingId("");
  }

  return (
    <section className="mx-auto max-w-5xl px-5 py-14 sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="section-kicker">Admin</p>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Risk & fraud dashboard</h1>
          <p className="mt-1 text-slate-500">Every score is a weighted, explainable breakdown — click a row to see why.</p>
        </div>
        <button
          onClick={recalculateAll}
          disabled={recalculating}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 disabled:opacity-60"
        >
          {recalculating ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Recalculate all
        </button>
      </div>

      {error && <p className="form-alert mt-6" role="alert">{error}</p>}

      <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-amber-800"><ShieldAlert size={16} /> Awaiting approval ({pending.length})</div>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-amber-700">No high-risk bookings waiting on a decision.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {pending.map((booking) => (
              <div key={booking.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-white px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-800">{booking.items?.title || "Rental item"}</p>
                  <p className="text-xs text-slate-500">Renter: {booking.renter?.full_name || "Unknown"} · {booking.start_date} → {booking.end_date} · ₹{Number(booking.total_amount).toFixed(0)}</p>
                </div>
                <div className="flex gap-2">
                  <button disabled={workingId === booking.id} onClick={() => resolveBooking(booking.id, "confirmed")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"><Check size={14} /> Approve</button>
                  <button disabled={workingId === booking.id} onClick={() => resolveBooking(booking.id, "cancelled")} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60"><X size={14} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <AlertTriangle size={14} /> All users by risk score
        </div>
        {loading ? (
          <div className="loading-state"><Loader2 className="animate-spin" /> Loading scores…</div>
        ) : (
          <RiskTable rows={scores} expandedId={expandedId} onToggle={(id) => setExpandedId(expandedId === id ? "" : id)} />
        )}
      </div>
    </section>
  );
}
