import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  Share2,
  MapPin,
  ShieldCheck,
  Star,
  CalendarClock,
} from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import DateRangePicker from "../components/DateRangePicker";
import ReportUserButton from "../components/ReportUserButton";

function daysBetween(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const ms = endDate - startDate;
  const days = Math.round(ms / (1000 * 60 * 60 * 24));
  return Math.max(1, days);
}

export default function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [item, setItem] = useState(null);
  const [owner, setOwner] = useState(null);
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState("");

  const [dates, setDates] = useState({
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: itemData } = await supabase
        .from("items")
        .select(`
          *,
          item_images(url, sort_order),
          categories(name, icon)
        `)
        .eq("id", id)
        .single();

      setItem(itemData);

      if (itemData) {
        const { data: ownerData } = await supabase
          .from("profiles")
          .select(`
            full_name,
            rating_avg,
            rating_count,
            location
          `)
          .eq("id", itemData.owner_id)
          .single();

        setOwner(ownerData);
        const { data: availabilityData } = await supabase.rpc("get_item_availability", { p_item_id: itemData.id });
        setAvailability(Array.isArray(availabilityData) ? availabilityData[0] : availabilityData);
      }

      setLoading(false);
    }

    load();
  }, [id]);

  const days = daysBetween(dates.startDate, dates.endDate);

  const total = item
    ? days * Number(item.price_per_day) + Number(item.deposit || 0)
    : 0;

  async function handleBook() {
    setError("");

    if (!user) {
      navigate("/login");
      return;
    }

    if (!dates.startDate || !dates.endDate) {
      setError("Please select rental dates.");
      return;
    }

    if (user.id === item.owner_id) {
      setError("You can't rent your own item.");
      return;
    }

    setBooking(true);

    const { data, error: bookingErr } = await supabase.rpc("create_rental_booking", {
      p_item_id: item.id,
      p_start_date: dates.startDate,
      p_end_date: dates.endDate,
    });

    setBooking(false);

    if (bookingErr) {
      setError(bookingErr.message);
      return;
    }

    const createdBooking = Array.isArray(data) ? data[0] : data;
    navigate(`/checkout/${createdBooking.id}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-14 w-14 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin mx-auto"></div>
          <p className="mt-6 text-slate-500 font-medium">Loading item...</p>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="text-7xl mb-6">📦</div>
          <h2 className="text-4xl font-bold">Item Not Found</h2>
          <p className="text-slate-500 mt-3">
            This listing may have been removed.
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-8 px-6 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >
            Back Home
          </button>
        </div>
      </div>
    );
  }

  const images = item.item_images?.length
    ? item.item_images
    : [{ url: null }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50"
    >
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Top Bar */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-600 hover:text-indigo-600"
          >
            <ArrowLeft size={18} />
            Back
          </button>

          <div className="flex gap-3">
            <button className="h-11 w-11 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition">
              <Heart size={18} />
            </button>
            <button className="h-11 w-11 rounded-full bg-white shadow flex items-center justify-center hover:scale-110 transition">
              <Share2 size={18} />
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-10">
          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-8">
            {/* Main Image */}
            <div className="rounded-3xl overflow-hidden shadow-xl">
              {images[0].url ? (
                <img
                  src={images[0].url}
                  alt={item.title}
                  className="w-full h-[550px] object-cover hover:scale-105 transition duration-700"
                />
              ) : (
                <div className="h-[550px] flex items-center justify-center text-7xl bg-slate-100">
                  📦
                </div>
              )}
            </div>

            {/* Thumbnail Images */}
            {images.length > 1 && (
              <div className="grid grid-cols-5 gap-3">
                {images.slice(1).map((img, i) => (
                  <img
                    key={i}
                    src={img.url}
                    alt=""
                    className="h-24 w-full object-cover rounded-2xl border border-slate-200 hover:border-indigo-500 cursor-pointer transition"
                  />
                ))}
              </div>
            )}

            {/* Description */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
              <h2 className="text-xl font-bold mb-4">Description</h2>
              <p className="leading-8 text-slate-600">
                {item.description || "No description available."}
              </p>
            </div>

            {/* Owner Details */}
            {owner && (
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-2xl font-bold text-indigo-700">
                    {owner.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{owner.full_name}</h3>
                    <p className="text-slate-500">{owner.location || "Verified Rentify member"}</p>
                  </div>
                </div>

                <div className="mt-5 flex gap-6">
                  <div className="flex items-center gap-2 text-slate-600">
                    <ShieldCheck className="text-green-500" />
                    Verified
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <Star className="text-yellow-500 fill-yellow-500" />
                    {owner.rating_count || 0} Reviews
                  </div>
                </div>

                <div className="mt-4 border-t border-slate-100 pt-3">
                  <ReportUserButton reportedUserId={item.owner_id} />
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">
            {/* Price Card */}
            <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100">
              <div className="flex items-end gap-2">
                <h2 className="text-4xl font-bold text-indigo-600">
                  ₹{Number(item.price_per_day).toFixed(0)}
                </h2>
                <span className="text-slate-500 mb-1">/ day</span>
              </div>
              {item.deposit > 0 && (
                <p className="mt-2 text-sm text-slate-500">
                  Refundable Deposit ₹{item.deposit}
                </p>
              )}
            </div>

            {/* Booking Sticky Card */}
            <div className="sticky top-28">
              <div className="rounded-3xl bg-white shadow-2xl border border-slate-200 p-6">
                <h2 className="text-2xl font-bold mb-6">Reserve this item</h2>

                {availability?.is_currently_rented && <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-900"><div className="flex items-center gap-2 font-bold"><CalendarClock size={18} /> Currently rented</div><p className="mt-1 leading-5">This item is rented until {new Date(`${availability.rented_until}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}. You can pre-order it from {new Date(`${availability.next_available_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.</p></div>}

                <DateRangePicker
                  startDate={dates.startDate}
                  endDate={dates.endDate}
                  onChange={setDates}
                  minDate={availability?.next_available_date}
                />

                {days > 0 && (
                  <div className="mt-6 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Rental</span>
                      <span>
                        ₹{item.price_per_day} × {days} day{days > 1 ? "s" : ""}
                      </span>
                    </div>

                    {item.deposit > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Deposit</span>
                        <span>₹{item.deposit}</span>
                      </div>
                    )}

                    <hr />

                    <div className="flex justify-between text-xl font-bold">
                      <span>Total</span>
                      <span className="text-indigo-600">
                        ₹{total.toFixed(0)}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="mt-4 text-red-500 text-sm">{error}</p>
                )}

                <button
                  disabled={!item.is_available || booking}
                  onClick={handleBook}
                  className="mt-6 w-full py-4 rounded-2xl bg-indigo-600 text-white font-semibold text-lg hover:bg-indigo-700 hover:scale-[1.02] active:scale-100 transition disabled:opacity-50"
                >
                  {!item.is_available
                    ? "Unavailable"
                    : booking
                    ? "Creating Booking..."
                    : availability?.is_currently_rented
                    ? "Pre-order for next availability"
                    : "Reserve Now"}
                </button>

                {!user && (
                  <p className="text-center text-sm text-slate-500 mt-4">
                    Login required before checkout
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
