import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, Heart, MapPin } from "lucide-react";

export default function ItemCard({ item, index = 0 }) {
  const image = item.item_images?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))?.[0]?.url;
  return <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.06, 0.3) }} whileHover={{ y: -7 }} className="item-card group">
    <Link to={`/item/${item.id}`} className="block">
      <div className="item-image">
        {image ? <img src={image} alt={item.title} /> : <div className="placeholder-image"><span>{item.categories?.icon || "📦"}</span></div>}
        <button onClick={(event) => event.preventDefault()} aria-label={`Save ${item.title}`} className="save-button"><Heart size={18} /></button>
        {!item.is_available && <div className="unavailable-overlay"><span>Currently rented</span></div>}
        <span className="price-tag">₹{Number(item.price_per_day).toFixed(0)} <small>/ day</small></span>
      </div>
      <div className="p-5"><p className="item-category">{item.categories?.icon || "✦"} {item.categories?.name || "Featured rental"}</p><h3>{item.title}</h3><p className="item-location"><MapPin size={15} /> {item.location || "Nearby"}</p><div className="item-action"><span>View details</span><ArrowUpRight size={18} /></div></div>
    </Link>
  </motion.article>;
}
