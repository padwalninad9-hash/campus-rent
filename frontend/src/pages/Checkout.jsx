import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export default function Checkout() {
  const { bookingId } = useParams();
  const { user, session, profile } = useAuth();
  const navigate = useNavigate();

  const [booking, setBooking] = useState(null);
  const [item, setItem] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | paying | error
  const [error, setError] = useState("");

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

  async function handlePay() {
    setError("");
    setStatus("paying");
    try {
      const order = await callFunction("create-razorpay-order", { booking_id: bookingId });

      const rzp = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.order_id,
        name: "Rentify",
        description: item?.title || "Rental booking",
        prefill: {
          name: profile?.full_name,
          email: user?.email,
        },
        theme: { color: "#1B2A46" },
        handler: async function (response) {
          try {
            await callFunction("verify-razorpay-payment", {
              booking_id: bookingId,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            navigate("/my-bookings");
          } catch (e) {
            setError(e.message);
            setStatus("error");
          }
        },
        modal: {
          ondismiss: function () {
            setStatus("ready");
          },
        },
      });

      rzp.open();
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  }

  if (status === "loading") return <p className="text-center py-24 font-mono text-sm text-ink/50">Loading…</p>;
  if (!booking) return <p className="text-center py-24">Booking not found.</p>;
  if (booking.status !== "pending_payment")
    return (
      <div className="text-center py-24">
        <p className="text-3xl mb-2">✅</p>
        <p className="font-medium">This booking is already {booking.status}.</p>
      </div>
    );

  return (
    <div className="max-w-md mx-auto px-5 py-16">
      <h1 className="font-display font-bold text-2xl mb-1">Confirm & pay</h1>
      <p className="text-ink/50 text-sm mb-7">Secure payment via Razorpay.</p>

      <div className="bg-white border border-line rounded-tag p-5">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-ink/60">Item</span>
          <span className="font-medium">{item?.title}</span>
        </div>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-ink/60">Dates</span>
          <span className="font-mono">
            {booking.start_date} → {booking.end_date}
          </span>
        </div>
        <div className="tag-perforation my-3" />
        <div className="flex justify-between font-mono font-semibold text-lg">
          <span>Total</span>
          <span className="text-amber">₹{Number(booking.total_amount).toFixed(0)}</span>
        </div>
      </div>

      {error && <p className="text-stamp text-sm mt-4">{error}</p>}

      <button className="btn-accent w-full mt-6" disabled={status === "paying"} onClick={handlePay}>
        {status === "paying" ? "Opening Razorpay…" : `Pay ₹${Number(booking.total_amount).toFixed(0)}`}
      </button>
    </div>
  );
}
