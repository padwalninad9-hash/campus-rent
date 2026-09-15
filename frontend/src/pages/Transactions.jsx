import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Receipt, ShieldCheck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const STATUS_STYLES = {
  created: "bg-slate-100 text-slate-600",
  paid: "bg-emerald-50 text-emerald-700",
  failed: "bg-rose-50 text-rose-700",
  refunded: "bg-indigo-50 text-indigo-700",
};

const ESCROW_STYLES = {
  held: "bg-amber-50 text-amber-700",
  released: "bg-emerald-50 text-emerald-700",
  refunded: "bg-indigo-50 text-indigo-700",
  disputed: "bg-rose-50 text-rose-700",
};

export default function Transactions() {
  const { user } = useAuth();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    async function load() {
      setLoading(true);
      // RLS already scopes this to payments on bookings where the caller is
      // the renter or the owner — no explicit filter needed here.
      const { data, error: loadError } = await supabase
        .from("payments")
        .select("*, bookings(start_date, end_date, items(title)), escrow_holds(status, refund_amount)")
        .order("created_at", { ascending: false });
      if (loadError) setError(loadError.message);
      setPayments(data || []);
      setLoading(false);
    }
    load();
  }, [user]);

  return (
    <section className="mx-auto max-w-3xl px-5 py-14 sm:px-7">
      <p className="section-kicker">Account</p>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Transaction history</h1>
      <p className="mt-1 text-slate-500">Every rent and deposit payment tied to your bookings, and where each deposit stands.</p>

      {error && <p className="form-alert mt-6" role="alert">{error}</p>}

      {loading ? (
        <div className="loading-state mt-8"><Loader2 className="animate-spin" /> Loading transactions…</div>
      ) : payments.length === 0 ? (
        <div className="empty-state mt-8"><Receipt className="mx-auto text-slate-300" size={32} /><h3>No transactions yet</h3><p>Payments show up here as soon as you book or someone books your item.</p></div>
      ) : (
        <div className="mt-8 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {payments.map((payment) => {
            const hold = payment.escrow_holds;
            return (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-slate-800">{payment.bookings?.items?.title || "Rental item"}</p>
                  <p className="text-xs text-slate-400">
                    {payment.type === "deposit" ? "Refundable deposit" : "Rent"} · {payment.bookings?.start_date} → {payment.bookings?.end_date} · {new Date(payment.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-slate-700">₹{Number(payment.amount).toFixed(0)}</span>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${STATUS_STYLES[payment.status] || "bg-slate-100 text-slate-600"}`}>{payment.status}</span>
                  {hold && (
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${ESCROW_STYLES[hold.status] || "bg-slate-100 text-slate-600"}`}>
                      <ShieldCheck size={12} /> {hold.status}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link to="/my-bookings" className="mt-6 inline-block text-sm font-bold text-indigo-600 hover:text-indigo-800">← Back to bookings</Link>
    </section>
  );
}
