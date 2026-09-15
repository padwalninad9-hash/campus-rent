// supabase/functions/verify-razorpay-payment/index.ts
//
// Called by the frontend right after Razorpay's Checkout widget succeeds,
// once per leg (rent, then deposit if this listing has one).
// Body: { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// - Recomputes the HMAC signature server-side and compares it — this is the
//   step that actually proves the payment is real, never trust the frontend alone.
// - On success: marks that leg's payment row "paid". If it was the deposit
//   leg, opens an escrow hold for it. Once every leg for the booking is
//   paid, the booking moves out of pending_payment (see _shared/booking.ts).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { finalizeBookingIfFullyPaid, holdDepositEscrow } from "../_shared/booking.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json();
    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      throw new Error("Missing fields");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new Error("Not authenticated");

    const expectedSignature = await hmacHex(
      Deno.env.get("RAZORPAY_KEY_SECRET")!,
      `${razorpay_order_id}|${razorpay_payment_id}`
    );

    if (expectedSignature !== razorpay_signature) {
      await supabase
        .from("payments")
        .update({ status: "failed", razorpay_payment_id })
        .eq("razorpay_order_id", razorpay_order_id);
      throw new Error("Signature mismatch — payment could not be verified");
    }

    const { data: booking, error: bookingLookupError } = await supabase
      .from("bookings")
      .select("id, renter_id")
      .eq("id", booking_id)
      .eq("renter_id", userData.user.id)
      .single();
    if (bookingLookupError || !booking) throw new Error("Booking not found");

    const { data: paymentRow, error: payErr } = await supabase
      .from("payments")
      .update({ status: "paid", razorpay_payment_id })
      .eq("razorpay_order_id", razorpay_order_id)
      .eq("booking_id", booking_id)
      .select("id, type")
      .single();
    if (payErr) throw new Error(payErr.message);

    if (paymentRow.type === "deposit") {
      await holdDepositEscrow(supabase, paymentRow.id);
    }

    const nextStatus = await finalizeBookingIfFullyPaid(supabase, booking_id);

    return new Response(JSON.stringify({ success: true, status: nextStatus || "pending_payment" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
