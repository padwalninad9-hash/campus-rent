// supabase/functions/razorpay-webhook/index.ts
//
// Configure this URL in the Razorpay Dashboard → Settings → Webhooks, subscribed
// to "payment.captured" and "payment.failed". This is the reliable backup path:
// even if the user closes their browser right after paying, this still fires
// and keeps your database correct.
//
// Set RAZORPAY_WEBHOOK_SECRET (the secret you set on the webhook in the dashboard)
// as a separate secret from RAZORPAY_KEY_SECRET.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature") ?? "";

    const expected = await hmacHex(Deno.env.get("RAZORPAY_WEBHOOK_SECRET")!, rawBody);
    if (expected !== signature) {
      return new Response("Invalid signature", { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      await supabase
        .from("payments")
        .update({ status: "paid", razorpay_payment_id: payment.id })
        .eq("razorpay_order_id", payment.order_id);

      const { data: paymentRow } = await supabase
        .from("payments")
        .select("booking_id")
        .eq("razorpay_order_id", payment.order_id)
        .single();

      if (paymentRow) {
        await supabase.from("bookings").update({ status: "confirmed" }).eq("id", paymentRow.booking_id);
      }
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await supabase
        .from("payments")
        .update({ status: "failed", razorpay_payment_id: payment.id })
        .eq("razorpay_order_id", payment.order_id);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
});
