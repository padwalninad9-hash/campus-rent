// supabase/functions/create-razorpay-order/index.ts
//
// Called by the frontend right before checkout.
// Body: { booking_id: string }
// - Looks up the booking's real total_amount from the database (so a user
//   can't tamper with the price from the browser).
// - Creates a Razorpay order for that amount.
// - Stores a "payments" row (service role only — RLS blocks clients from this table).
// - Returns { order_id, amount, currency, key_id } for the frontend Checkout widget.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) throw new Error("booking_id is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is the renter on this booking
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new Error("Not authenticated");

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, total_amount, renter_id, status")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) throw new Error("Booking not found");
    if (booking.renter_id !== userData.user.id) throw new Error("Not your booking");
    if (booking.status !== "pending_payment") throw new Error("Booking is not payable");

    const amountPaise = Math.round(Number(booking.total_amount) * 100);

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const auth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: "INR",
        receipt: `booking_${booking.id}`,
        notes: { booking_id: booking.id },
      }),
    });

    const rpOrder = await rpRes.json();
    if (!rpRes.ok) throw new Error(rpOrder?.error?.description || "Razorpay order creation failed");

    const { error: payErr } = await supabase.from("payments").insert({
      booking_id: booking.id,
      razorpay_order_id: rpOrder.id,
      amount: booking.total_amount,
      status: "created",
    });
    if (payErr) throw new Error(payErr.message);

    return new Response(
      JSON.stringify({
        order_id: rpOrder.id,
        amount: amountPaise,
        currency: "INR",
        key_id: razorpayKeyId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
