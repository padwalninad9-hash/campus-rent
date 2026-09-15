// supabase/functions/resolve-escrow/index.ts
//
// The only place that moves a deposit out of "held" — every path here ends
// in a real Razorpay test-mode refund call, so it has to run server-side
// with the secret key (never trust the browser to report its own refund).
//
// Body always has an `action`:
//   { action: "complete", booking_id }
//     Owner (or admin) marks a rental returned. Booking -> completed, its
//     deposit (if any) is fully refunded via Razorpay, escrow_holds -> released.
//   { action: "dispute", escrow_hold_id, note? }
//     Admin flags a damage/dispute claim. escrow_holds -> disputed. No money moves.
//   { action: "refund", escrow_hold_id, amount, note? }
//     Admin resolves a dispute (or otherwise decides the outcome): refunds
//     `amount` (can be less than the full deposit — the rest stays with
//     Rentify/the owner, since real payout-splitting needs a licensed
//     aggregator this project doesn't have) via Razorpay. escrow_holds -> refunded.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function razorpayRefund(paymentId: string, amountPaise: number | undefined) {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")!;
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")!;
  const authBasic = btoa(`${keyId}:${keySecret}`);
  const body: Record<string, unknown> = { speed: "normal" };
  if (amountPaise !== undefined) body.amount = amountPaise;

  const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${authBasic}` },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.description || "Razorpay refund failed");
  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userData?.user) throw new Error("Not authenticated");
    const callerId = userData.user.id;

    const { data: callerProfile } = await supabase.from("profiles").select("is_admin").eq("id", callerId).single();
    const callerIsAdmin = !!callerProfile?.is_admin;

    const body = await req.json();

    if (body.action === "complete") {
      const { booking_id } = body;
      if (!booking_id) throw new Error("booking_id is required");

      const { data: booking, error: bookingErr } = await supabase
        .from("bookings")
        .select("id, owner_id, status")
        .eq("id", booking_id)
        .single();
      if (bookingErr || !booking) throw new Error("Booking not found");
      if (booking.owner_id !== callerId && !callerIsAdmin) throw new Error("Only the owner can mark this returned");
      if (booking.status !== "ongoing") throw new Error("Only an ongoing rental can be marked returned");

      const { error: statusErr } = await supabase.from("bookings").update({ status: "completed" }).eq("id", booking_id);
      if (statusErr) throw new Error(statusErr.message);

      const { data: depositPayment } = await supabase
        .from("payments")
        .select("id, razorpay_payment_id, amount")
        .eq("booking_id", booking_id)
        .eq("type", "deposit")
        .eq("status", "paid")
        .maybeSingle();

      if (depositPayment) {
        const { data: hold } = await supabase
          .from("escrow_holds")
          .select("id, status")
          .eq("payment_id", depositPayment.id)
          .single();

        if (hold && hold.status === "held") {
          await razorpayRefund(depositPayment.razorpay_payment_id, undefined); // full refund
          await supabase
            .from("escrow_holds")
            .update({ status: "released", refund_amount: depositPayment.amount, released_at: new Date().toISOString() })
            .eq("id", hold.id);
          await supabase.from("payments").update({ status: "refunded" }).eq("id", depositPayment.id);
        }
      }

      return new Response(JSON.stringify({ success: true, status: "completed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!callerIsAdmin) throw new Error("Admin access required");

    if (body.action === "dispute") {
      const { escrow_hold_id, note } = body;
      if (!escrow_hold_id) throw new Error("escrow_hold_id is required");

      const { error } = await supabase
        .from("escrow_holds")
        .update({ status: "disputed", resolution_note: note || null })
        .eq("id", escrow_hold_id)
        .eq("status", "held");
      if (error) throw new Error(error.message);

      return new Response(JSON.stringify({ success: true, status: "disputed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.action === "refund") {
      const { escrow_hold_id, amount, note } = body;
      if (!escrow_hold_id) throw new Error("escrow_hold_id is required");

      const { data: hold, error: holdErr } = await supabase
        .from("escrow_holds")
        .select("id, status, payment_id, payments(razorpay_payment_id, amount)")
        .eq("id", escrow_hold_id)
        .single();
      if (holdErr || !hold) throw new Error("Escrow hold not found");
      if (hold.status !== "held" && hold.status !== "disputed") throw new Error("This deposit isn't in a refundable state");

      const fullAmount = Number((hold as any).payments.amount);
      const refundAmount = amount != null ? Math.min(Number(amount), fullAmount) : fullAmount;
      if (refundAmount < 0) throw new Error("Refund amount can't be negative");

      if (refundAmount > 0) {
        await razorpayRefund((hold as any).payments.razorpay_payment_id, Math.round(refundAmount * 100));
      }

      await supabase
        .from("escrow_holds")
        .update({ status: "refunded", refund_amount: refundAmount, resolution_note: note || null, released_at: new Date().toISOString() })
        .eq("id", escrow_hold_id);
      await supabase.from("payments").update({ status: "refunded" }).eq("id", hold.payment_id);

      return new Response(JSON.stringify({ success: true, status: "refunded", refund_amount: refundAmount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Unknown action");
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
