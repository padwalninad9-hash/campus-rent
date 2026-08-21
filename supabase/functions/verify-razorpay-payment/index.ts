// supabase/functions/verify-razorpay-payment/index.ts
//
// Called by the frontend right after Razorpay's Checkout widget succeeds.
// Body: { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature }
// - Recomputes the HMAC signature server-side and compares it — this is the
//   step that actually proves the payment is real, never trust the frontend alone.
// - On success: marks the payment "paid" and the booking "confirmed".

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const { error: payErr } = await supabase
      .from("payments")
      .update({ status: "paid", razorpay_payment_id })
      .eq("razorpay_order_id", razorpay_order_id);
    if (payErr) throw new Error(payErr.message);

    const { error: bookingErr } = await supabase
      .from("bookings")
      .update({ status: "confirmed" })
      .eq("id", booking_id)
      .eq("renter_id", userData.user.id);
    if (bookingErr) throw new Error(bookingErr.message);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
