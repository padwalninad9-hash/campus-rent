import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const LEG_LABEL = { rent: "Rent", deposit: "Refundable deposit" };

export default function Checkout() {
  const { bookingId } = useParams();
  const { user, session, profile } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | paying | error
  const [error, setError] = useState("");
  const [currentLeg, setCurrentLeg] = useState(""); // "" | "rent" | "deposit"

  useEffect(() => {
    async function load() {
      const { data: bookingData } = await supabase
        .from("bookings")
        .select("*")
        .eq("id", bookingId)
        .single();
      setBooking(bookingData);

      if (bookingData) {
        const { data: itemData } = await supabase
          .from("items")
          .select("title")
          .eq("id", bookingData.item_id)
          .single();
        setItem(itemData);
      }
      setStatus("ready");
    }
    load();
  }, [bookingId]);

  async function callFunction(name, body) {
    const res = await fetch(`${FUNCTIONS_URL}/${name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Something went wrong");
    return json;
  }

  // Opens Razorpay Checkout for one leg, verifies it server-side on success,
  // then recurses into the next leg (deposit only exists if the listing has one).
  function payLeg(legs, index, meta) {
    if (index >= legs.length) {
      navigate("/my-bookings");
      return;
    }
    const leg = legs[index];
    setCurrentLeg(leg.type);

    const rzp = new window.Razorpay({
      key: meta.key_id,
      amount: leg.amount,
      currency: meta.currency,
      order_id: leg.order_id,
      name: "Rentify",
      description: `${LEG_LABEL[leg.type]} — ${item?.title || "Rental booking"}`,
      prefill: { name: profile?.full_name, email: user?.email },
      theme: { color: "#4f46e5" },
      handler: async function (response) {
        try {
          await callFunction("verify-razorpay-payment", {
            booking_id: bookingId,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          payLeg(legs, index + 1, meta);
        } catch (e) {
          setError(e.message);
          setStatus("error");
        }
      },
      modal: {
        ondismiss: function () {
          setStatus("ready");
          setCurrentLeg("");
        },
      },
    });

    rzp.open();
  }

  async function handlePay() {
    setError("");
    setStatus("paying");
    try {
      const order = await callFunction("create-razorpay-order", { booking_id: bookingId });
      payLeg(order.legs, 0, { key_id: order.key_id, currency: order.currency });
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  if (status === "loading") return <p className="text-center py-24 font-mono text-sm text-slate-400">Loading…</p>;
  if (!booking) return <p className="text-center py-24">Booking not found.</p>;
  if (booking.status !== "pending_payment")
    return (
      <div className="text-center py-24">
        <p className="text-3xl mb-2">✅</p>
        <p className="font-medium">This booking is already {booking.status.replace("_", " ")}.</p>
      </div>
    );

  const depositAmount = Number(booking.deposit_amount || 0);
  const rentAmount = Number(booking.total_amount) - depositAmount;

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display font-bold text-2xl mb-1">Confirm & pay</h1>
      <p className="text-slate-500 text-sm mb-7">Secure payment via Razorpay{depositAmount > 0 ? " — rent and deposit are charged as two separate payments" : ""}.</p>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-500">Item</span>
          <span className="font-medium">{item?.title}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-500">Dates</span>
          <span className="font-mono">
            {booking.start_date} → {booking.end_date}
          </span>
        </div>
        <hr className="my-3 border-slate-100" />
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-500">Rent</span>
          <span className="font-mono">₹{rentAmount.toFixed(0)}</span>
        </div>
        {depositAmount > 0 && (
          <div className="flex justify-between text-sm mb-1">
            <span className="text-slate-500">Refundable deposit</span>
            <span className="font-mono">₹{depositAmount.toFixed(0)}</span>
          </div>
        )}
        <hr className="my-3 border-slate-100" />
        <div className="flex justify-between font-mono font-semibold text-lg">
          <span>Total</span>
          <span className="text-indigo-600">₹{Number(booking.total_amount).toFixed(0)}</span>
        </div>
        {depositAmount > 0 && <p className="mt-2 text-xs text-slate-400">The deposit is held and refunded in full once the rental is returned — see it any time in your transaction history.</p>}
      </div>

      {error && <p className="text-rose-600 text-sm font-medium mt-4">{error}</p>}

      <button className="btn-primary w-full mt-6 justify-center" disabled={status === "paying"} onClick={handlePay}>
        {status === "paying" ? `Opening Razorpay${currentLeg ? ` (${LEG_LABEL[currentLeg]})` : ""}…` : `Pay ₹${Number(booking.total_amount).toFixed(0)}`}
      </button>
    </div>
  );
}
