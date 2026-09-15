import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, Check, Loader2, ShieldQuestion, Undo2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const STATUS_STYLES = {
  held: "bg-amber-50 text-amber-700",
  released: "bg-emerald-50 text-emerald-700",
  refunded: "bg-indigo-50 text-indigo-700",
  disputed: "bg-rose-50 text-rose-700",
};

function PartialRefundForm({ hold, onSubmit, working }) {
  const [amount, setAmount] = useState(Number(hold.payments.amount));
  return (
    <form
      onSubmit={(event) => { event.preventDefault(); onSubmit(hold.id, amount); }}
      className="mt-3 flex flex-wrap items-center gap-2"
    >
      <span className="text-xs text-slate-500">Refund amount (of ₹{Number(hold.payments.amount).toFixed(0)})</span>
      <input
        type="number"
        min="0"
        max={hold.payments.amount}
        step="1"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        className="w-24 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-indigo-400"
      />
      <button type="submit" disabled={working} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
        {working ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />} Resolve dispute
      </button>
    </form>
  );
}

export default function AdminEscrow() {
  const { session } = useAuth();
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [workingId, setWorkingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("escrow_holds")
      .select("*, payments(amount, razorpay_payment_id, booking_id, bookings(start_date, end_date, items(title), renter:profiles!bookings_renter_id_fkey(full_name)))")
      .order("held_at", { ascending: false });
    if (loadError) setError(loadError.message);
    setHolds(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function act(escrow_hold_id, action, extra = {}) {
    setWorkingId(escrow_hold_id);
    setError("");
    try {
      const res = await fetch(`${FUNCTIONS_URL}/resolve-escrow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action, escrow_hold_id, ...extra }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setWorkingId("");
    }
  }

  const heldCount = holds.filter((h) => h.status === "held").length;

  return (
    <section className="mx-auto max-w-4xl px-5 py-14 sm:px-7">
      <p className="section-kicker">Admin</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Escrow dashboard</h1>
      <p className="mt-1 text-slate-500">{heldCount} deposit{heldCount === 1 ? "" : "s"} currently held. Deposits release automatically when an owner marks a rental returned — use this only for disputes or manual corrections.</p>

      {error && <p className="form-alert mt-6" role="alert">{error}</p>}

      {loading ? (
        <div className="loading-state mt-8"><Loader2 className="animate-spin" /> Loading escrow holds…</div>
      ) : holds.length === 0 ? (
        <p className="mt-8 text-sm text-slate-500">No deposits have been collected yet.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {holds.map((hold) => (
            <div key={hold.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800">{hold.payments?.bookings?.items?.title || "Rental item"}</p>
                  <p className="text-xs text-slate-500">
                    Renter: {hold.payments?.bookings?.renter?.full_name || "Unknown"} · {hold.payments?.bookings?.start_date} → {hold.payments?.bookings?.end_date} · ₹{Number(hold.payments?.amount).toFixed(0)} deposit
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[hold.status]}`}>{hold.status}</span>
              </div>

              {hold.status === "held" && (
                <div className="mt-3 flex gap-2">
                  <button disabled={workingId === hold.id} onClick={() => act(hold.id, "refund")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                    {workingId === hold.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Release full refund
                  </button>
                  <button disabled={workingId === hold.id} onClick={() => act(hold.id, "dispute")} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-60">
                    <AlertOctagon size={13} /> Flag dispute
                  </button>
                </div>
              )}

              {hold.status === "disputed" && (
                <>
                  <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-rose-600"><ShieldQuestion size={14} /> {hold.resolution_note || "Flagged for review — no note left."}</p>
                  <PartialRefundForm hold={hold} working={workingId === hold.id} onSubmit={(id, amount) => act(id, "refund", { amount })} />
                </>
              )}

              {(hold.status === "released" || hold.status === "refunded") && hold.refund_amount != null && (
                <p className="mt-2 text-xs text-slate-400">Refunded ₹{Number(hold.refund_amount).toFixed(0)} on {new Date(hold.released_at).toLocaleString()}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
