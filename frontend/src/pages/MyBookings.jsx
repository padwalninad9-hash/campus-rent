import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, CheckCircle2, ChevronRight, Loader2, PackageCheck, PlayCircle } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

const statusLabel = (status) => ({ pending_payment: "Awaiting payment", pending_review: "Under review", confirmed: "Confirmed", ongoing: "In progress", completed: "Completed", cancelled: "Cancelled" }[status] || status);
function BookingCard({ booking, ownerView, onStatus, working }) {
  const image = booking.items?.item_images?.[0]?.url;
  const nextAction = ownerView && ({ confirmed: ["ongoing", "Start rental", PlayCircle], ongoing: ["completed", "Mark returned", PackageCheck] }[booking.status]);
  const ActionIcon = nextAction?.[2];
  return <article className="booking-card"><Link to={`/item/${booking.item_id}`} className="booking-image">{image ? <img src={image} alt="" /> : "📦"}</Link><div className="booking-body"><div className="booking-topline"><span className={`booking-status ${booking.status}`}>{statusLabel(booking.status)}</span><span>Booking #{booking.id.slice(0, 6)}</span></div><Link to={`/item/${booking.item_id}`}><h2>{booking.items?.title || "Rental item"}</h2></Link><p className="booking-dates"><CalendarDays size={15} /> {new Date(`${booking.start_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – {new Date(`${booking.end_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p><div className="booking-footer"><strong>₹{Number(booking.total_amount).toLocaleString("en-IN")}</strong>{booking.status === "pending_payment" && !ownerView ? <Link to={`/checkout/${booking.id}`} className="booking-action">Complete payment <ChevronRight size={16} /></Link> : booking.status === "pending_review" ? <span className="booking-note">Payment received — waiting on admin review</span> : nextAction ? <button className="booking-action" disabled={working} onClick={() => onStatus(booking.id, nextAction[0])}>{working ? <Loader2 className="animate-spin" size={16} /> : <ActionIcon size={16} />}{nextAction[1]}</button> : booking.status === "pending_payment" && ownerView ? <span className="booking-note">Waiting for renter</span> : <span className="booking-note">{ownerView ? "Host view" : "Your booking"}</span>}</div></div></article>;
}
export default function MyBookings() {
  const { user, session } = useAuth(); const [renting, setRenting] = useState([]); const [incoming, setIncoming] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(""); const [workingId, setWorkingId] = useState("");
  const load = useCallback(async () => { if (!user) return; setLoading(true); setError(""); const fields = "*, items(title, item_images(url, sort_order))"; const [{ data: renterData, error: renterError }, { data: ownerData, error: ownerError }] = await Promise.all([supabase.from("bookings").select(fields).eq("renter_id", user.id).order("created_at", { ascending: false }), supabase.from("bookings").select(fields).eq("owner_id", user.id).order("created_at", { ascending: false })]); if (renterError || ownerError) setError((renterError || ownerError).message); setRenting(renterData || []); setIncoming(ownerData || []); setLoading(false); }, [user]);
  useEffect(() => { load(); }, [load]);
  async function updateStatus(id, status) {
    setWorkingId(id); setError("");
    if (status === "completed") {
      // Routes through resolve-escrow so a paid deposit is refunded server-side
      // in the same step the booking is marked returned — see Module 3.
      try {
        const res = await fetch(`${FUNCTIONS_URL}/resolve-escrow`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "complete", booking_id: id }) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Couldn't complete this booking");
      } catch (completeError) { setError(completeError.message); }
    } else {
      const { error: updateError } = await supabase.from("bookings").update({ status }).eq("id", id);
      if (updateError) setError(updateError.message);
    }
    await load(); setWorkingId("");
  }
  return <section className="market-page"><div className="market-wrap"><div className="page-heading"><div><p className="section-kicker">Rental dashboard</p><h1>Bookings</h1><p>Track the items you are renting and manage requests on your own listings.</p></div></div>{error && <p className="form-alert" role="alert">{error}</p>}{loading ? <div className="loading-state"><Loader2 className="animate-spin" /> Loading bookings…</div> : <div className="booking-sections"><section><div className="booking-section-heading"><div><h2>Things you’re renting</h2><p>Payments and upcoming pickup dates.</p></div><span>{renting.length}</span></div>{renting.length ? <div className="booking-list">{renting.map((booking) => <BookingCard key={booking.id} booking={booking} working={workingId === booking.id} onStatus={updateStatus} />)}</div> : <div className="empty-inline"><CalendarDays size={25} /><p>You have no bookings yet.</p><Link to="/">Explore rentals</Link></div>}</section><section><div className="booking-section-heading"><div><h2>Bookings on your items</h2><p>Confirm payments, then start and complete rentals.</p></div><span>{incoming.length}</span></div>{incoming.length ? <div className="booking-list">{incoming.map((booking) => <BookingCard key={booking.id} booking={booking} ownerView working={workingId === booking.id} onStatus={updateStatus} />)}</div> : <div className="empty-inline"><CheckCircle2 size={25} /><p>No one has booked your items yet.</p><Link to="/add-item">List another item</Link></div>}</section></div>}</div></section>;
}
