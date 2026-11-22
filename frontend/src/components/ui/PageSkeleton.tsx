/** Placeholder layout shown while a member page loads. */
export function PageSkeleton() {
  return (
    <div className="animate-fade-in" aria-busy="true" aria-label="Loading">
      <div className="skeleton h-9 w-72 rounded-full" />
      <div className="skeleton mt-space-sm h-4 w-96 max-w-full rounded-full" />
      <div className="mt-space-lg grid gap-space-md sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-24 rounded-2xl" />
        ))}
      </div>
      <div className="mt-space-lg grid gap-space-lg lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-space-md">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-48 rounded-2xl" />
          ))}
        </div>
        <div className="hidden space-y-space-md lg:block">
          <div className="skeleton h-64 rounded-2xl" />
          <div className="skeleton h-40 rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
