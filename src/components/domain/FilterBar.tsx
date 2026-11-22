import { Search, SlidersHorizontal } from "lucide-react";

export function FilterBar({
  placeholder = "Search verified shops, investors and loans…",
}: {
  placeholder?: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-space-sm">
      <label className="relative min-w-[220px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-outline" aria-hidden />
        <input
          type="search"
          placeholder={placeholder}
          aria-label="Search"
          className="w-full rounded-full bg-surface-container-lowest py-2.5 pl-10 pr-4 text-body-md text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary card-shadow"
        />
      </label>
      <button type="button" className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-space-md py-2.5 text-label-md font-semibold text-on-surface-variant card-shadow hover:text-primary">
        <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filters
      </button>
    </div>
  );
}
