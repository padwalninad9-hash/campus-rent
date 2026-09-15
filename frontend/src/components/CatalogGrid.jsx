import ItemCard from "./ItemCard";

export default function CatalogGrid({ items, loading }) {
  if (loading) return <div className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="loading-card" />)}</div>;
  return <div className="mt-9 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{items.map((item, index) => <ItemCard key={item.id} item={item} index={index} />)}</div>;
}
