import { motion } from "framer-motion";

export default function CategoryChips({
  categories,
  activeId,
  onSelect,
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-hide">

      {/* All */}
      <motion.button
        whileTap={{ scale: 0.95 }}
        whileHover={{ y: -2 }}
        onClick={() => onSelect(null)}
        className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300
        ${
          activeId === null
            ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg"
            : "bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md"
        }`}
      >
        ✨ All
      </motion.button>

      {categories.map((category) => (
        <motion.button
          key={category.id}
          whileHover={{
            y: -2,
            scale: 1.02,
          }}
          whileTap={{ scale: 0.96 }}
          onClick={() => onSelect(category.id)}
          className={`flex items-center gap-2 whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-semibold transition-all duration-300
          ${
            activeId === category.id
              ? "bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg"
              : "bg-white border border-slate-200 hover:border-indigo-400 hover:shadow-md"
          }`}
        >
          <span className="text-lg">
            {category.icon}
          </span>

          <span>
            {category.name}
          </span>
        </motion.button>
      ))}
    </div>
  );
}