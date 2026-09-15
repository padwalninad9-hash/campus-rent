// supabase/functions/_shared/booking.ts
//
// Shared between verify-razorpay-payment and razorpay-webhook — a booking
// can be paid off in two legs (rent, then a refundable deposit), and both
// the browser-driven verify call and the server-to-server webhook need to
// apply the exact same "is this booking now fully paid, and does the
// renter's risk level route it to confirmed or pending_review" logic. One
// implementation here keeps the two paths from drifting apart.

// Both the browser-driven verify call and the webhook can independently
// observe the same deposit payment turn "paid" (that redundancy is the
// whole point of the webhook backup path) — upsert so the second call is a
// harmless no-op instead of tripping escrow_holds' unique payment_id.
export async function holdDepositEscrow(supabase: any, paymentId: string) {
  await supabase.from("escrow_holds").upsert(
    { payment_id: paymentId, status: "held", held_at: new Date().toISOString() },
    { onConflict: "payment_id", ignoreDuplicates: true }
  );
}

// Call after marking a leg (rent or deposit) as paid. Once a paid row exists
// for every leg the booking actually needs, moves the booking out of
// pending_payment — to pending_review for high-risk renters, confirmed
// otherwise. Returns the new status, or null if a required leg is still
// outstanding / the booking was already resolved.
export async function finalizeBookingIfFullyPaid(supabase: any, bookingId: string) {
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, item_id, renter_id, start_date, end_date, status, deposit_amount")
    .eq("id", bookingId)
    .single();
  if (bookingErr || !booking) throw new Error("Booking not found");
  if (booking.status !== "pending_payment") return null; // already resolved

  // A leg only counts once it has an actually-paid row — a stale "created"
  // row left behind by a closed/abandoned Razorpay widget (the renter
  // reopening checkout and paying on a retry) must not permanently block
  // finalization just because that earlier attempt never completed.
  const { data: paidPayments, error: paymentsErr } = await supabase
    .from("payments")
    .select("type")
    .eq("booking_id", bookingId)
    .eq("status", "paid");
  if (paymentsErr) throw new Error(paymentsErr.message);
  const paidTypes = new Set((paidPayments || []).map((p: { type: string }) => p.type));

  const needsDeposit = Number(booking.deposit_amount) > 0;
  const fullyPaid = paidTypes.has("rent") && (!needsDeposit || paidTypes.has("deposit"));
  if (!fullyPaid) return null;

  const { data: conflictingBooking, error: conflictErr } = await supabase
    .from("bookings")
    .select("id")
    .eq("item_id", booking.item_id)
    .in("status", ["confirmed", "ongoing", "pending_review"])
    .neq("id", booking.id)
    .lte("start_date", booking.end_date)
    .gte("end_date", booking.start_date)
    .maybeSingle();
  if (conflictErr) throw new Error(conflictErr.message);
  if (conflictingBooking) {
    throw new Error("Those dates were just reserved by another renter. Please contact support for payment assistance.");
  }

  const { data: risk } = await supabase
    .from("user_risk_scores")
    .select("risk_level")
    .eq("user_id", booking.renter_id)
    .maybeSingle();
  const nextStatus = risk?.risk_level === "high" ? "pending_review" : "confirmed";

  // Guard against the verify call and the webhook racing each other for the
  // same booking: only the update that still finds pending_payment applies.
  const { data: updated, error: updateErr } = await supabase
    .from("bookings")
    .update({ status: nextStatus })
    .eq("id", bookingId)
    .eq("status", "pending_payment")
    .select("id")
    .maybeSingle();
  if (updateErr) throw new Error(updateErr.message);
  if (!updated) return null; // the other path already resolved it

  return nextStatus;
}
