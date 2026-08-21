import { Heart } from "lucide-react";

export default function Footer() {
  return <footer className="site-footer"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-10 sm:px-7 md:flex-row md:items-center md:justify-between"><div><p className="brand"><span className="brand-mark">R</span><span>rent<span>ify</span></span></p><p className="mt-3 text-sm text-slate-500">Borrow more, buy less. Rent what you need.</p></div><p className="flex items-center gap-1 text-sm text-slate-500">Made with <Heart size={14} className="fill-rose-400 text-rose-400" /> for the sharing economy</p></div></footer>;
}
