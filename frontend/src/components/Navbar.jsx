import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";
import { Compass, LogOut, Menu, Package, Plus, Receipt, ShieldAlert, ShieldCheck, ShoppingBag, User, X } from "lucide-react";
import { useState } from "react";

export default function Navbar() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const active = (path) => location.pathname === path ? "nav-link nav-link-active" : "nav-link";
  const close = () => setOpen(false);
  const signedInLinks = <><Link onClick={close} to="/catalog" className={active("/catalog")}><Compass size={17} /> Explore</Link><Link onClick={close} to="/add-item" className={active("/add-item")}><Plus size={17} /> List an item</Link><Link onClick={close} to="/my-bookings" className={active("/my-bookings")}><ShoppingBag size={17} /> Bookings</Link><Link onClick={close} to="/my-listings" className={active("/my-listings")}><Package size={17} /> Listings</Link><Link onClick={close} to="/transactions" className={active("/transactions")}><Receipt size={17} /> Payments</Link>{profile?.is_admin && <><Link onClick={close} to="/admin/risk" className={active("/admin/risk")}><ShieldAlert size={17} /> Risk admin</Link><Link onClick={close} to="/admin/escrow" className={active("/admin/escrow")}><ShieldCheck size={17} /> Escrow admin</Link></>}</>;

  return <motion.header initial={{ y: -18, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.45 }} className="site-header">
    <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-7">
      <Link to="/" onClick={close} className="brand"><span className="brand-mark">R</span><span>rent<span>ify</span></span></Link>
      <nav className="hidden items-center gap-1 md:flex">{user ? signedInLinks : <><Link className="nav-link" to="/catalog">Explore</Link><Link className="nav-link" to="/login">How it works</Link></>} </nav>
      <div className="hidden items-center gap-3 md:flex">{user ? <><Link to="/profile" className="profile-pill"><User size={16} /> {profile?.full_name?.split(" ")[0] || "My profile"}</Link><button onClick={async () => { await signOut(); navigate("/"); }} className="icon-button" title="Log out"><LogOut size={18} /></button></> : <><Link to="/login" className="font-semibold text-slate-700 hover:text-indigo-600">Log in</Link><Link to="/signup" className="btn-primary">Get started <Plus size={17} /></Link></>}</div>
      <button className="icon-button md:hidden" onClick={() => setOpen(!open)} aria-label="Toggle menu">{open ? <X size={20} /> : <Menu size={21} />}</button>
    </div>
    {open && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mobile-menu">{user ? signedInLinks : <><a onClick={close} className="nav-link" href="/#listings">Explore rentals</a><Link onClick={close} className="nav-link" to="/login">Log in</Link><Link onClick={close} className="btn-primary justify-center" to="/signup">Get started</Link></>}</motion.div>}
  </motion.header>;
}
