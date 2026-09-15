// supabase/functions/create-razorpay-order/index.ts
//
// Called by the frontend right before checkout.
// Body: { booking_id: string }
// - Looks up the booking's real total_amount / deposit_amount from the
//   database (so a user can't tamper with the price from the browser).
// - Creates a Razorpay order for the rent portion, and — if this listing has
//   a refundable deposit — a SEPARATE order for the deposit. They're charged
//   as two distinct payments so the deposit can be tracked and released
//   independently of the rent (see escrow_holds / resolve-escrow).
// - Stores a "payments" row per leg (service role only — RLS blocks clients
//   from this table).
// - Returns { legs: [{ type, order_id, amount }], currency, key_id } for the
//   frontend to run through Razorpay's Checkout widget one leg at a time.

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

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new Error("Not authenticated");

    const { data: booking, error: bookingErr } = await supabase
      .from("bookings")
      .select("id, total_amount, deposit_amount, renter_id, status")
      .eq("id", booking_id)
      .single();

    if (bookingErr || !booking) throw new Error("Booking not found");
    if (booking.renter_id !== userData.user.id) throw new Error("Not your booking");
    if (booking.status !== "pending_payment") throw new Error("Booking is not payable");

    // Don't re-create orders for legs already paid (e.g. rent succeeded,
    // browser closed before the deposit leg — resuming should only charge
    // what's still outstanding).
    const { data: existingPayments } = await supabase
      .from("payments")
      .select("type, status")
      .eq("booking_id", booking.id);
    const alreadyPaid = new Set(
      (existingPayments || []).filter((p) => p.status === "paid").map((p) => p.type)
    );

    const depositAmount = Number(booking.deposit_amount || 0);
    const rentAmount = Number(booking.total_amount) - depositAmount;

    const legsToCreate: { type: "rent" | "deposit"; amount: number }[] = [];
    if (!alreadyPaid.has("rent") && rentAmount > 0) legsToCreate.push({ type: "rent", amount: rentAmount });
    if (!alreadyPaid.has("deposit") && depositAmount > 0) legsToCreate.push({ type: "deposit", amount: depositAmount });

    if (legsToCreate.length === 0) throw new Error("This booking is already fully paid");

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID")!;
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
    const authBasic = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const legs = [];
    for (const leg of legsToCreate) {
      const amountPaise = Math.round(leg.amount * 100);

      const rpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Basic ${authBasic}` },
        body: JSON.stringify({
          amount: amountPaise,
          currency: "INR",
          receipt: `booking_${booking.id}_${leg.type}`,
          notes: { booking_id: booking.id, type: leg.type },
        }),
      });

      const rpOrder = await rpRes.json();
      if (!rpRes.ok) throw new Error(rpOrder?.error?.description || `Razorpay ${leg.type} order creation failed`);

      const { error: payErr } = await supabase.from("payments").insert({
        booking_id: booking.id,
        razorpay_order_id: rpOrder.id,
        amount: leg.amount,
        type: leg.type,
        status: "created",
      });
      if (payErr) throw new Error(payErr.message);

      legs.push({ type: leg.type, order_id: rpOrder.id, amount: amountPaise });
    }

    return new Response(
      JSON.stringify({ legs, currency: "INR", key_id: razorpayKeyId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
