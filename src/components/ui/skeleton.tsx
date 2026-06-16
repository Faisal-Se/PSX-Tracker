import { cn } from "@/lib/utils";

/** Token-based shimmer block. Uses the `.skeleton` sweep from globals.css. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} {...props} />;
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-card p-[22px] shadow-card space-y-3",
        className
      )}
    >
      <Skeleton className="h-[26px] w-[26px] rounded-lg" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

function RowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-line-soft px-[22px] py-3 last:border-0">
      <Skeleton className="h-9 w-9 shrink-0 rounded-[10px]" />
      {Array.from({ length: columns - 1 }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === 0 ? "w-32 flex-1" : "w-16")}
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div>
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

/**
 * Animated chart placeholder — a faux area silhouette with shimmer and y-axis
 * ticks. Used by the NAV/benchmark charts while history loads.
 */
function ChartSkeleton({ height = 260, className }: { height?: number; className?: string }) {
  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      {/* y ticks */}
      <div className="absolute inset-y-0 left-0 flex w-9 flex-col justify-between py-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-7" />
        ))}
      </div>
      {/* area silhouette */}
      <div className="absolute inset-y-2 left-11 right-0 overflow-hidden rounded-lg">
        <div
          className="skeleton h-full w-full"
          style={{
            WebkitMaskImage:
              "linear-gradient(to top, black 0%, black 35%, transparent 95%)",
            maskImage:
              "linear-gradient(to top, black 0%, black 35%, transparent 95%)",
            clipPath:
              "polygon(0% 78%, 8% 70%, 18% 74%, 28% 58%, 38% 63%, 48% 44%, 58% 52%, 68% 36%, 78% 42%, 88% 24%, 100% 14%, 100% 100%, 0% 100%)",
          }}
        />
      </div>
    </div>
  );
}

/** Full-page skeleton matching the new dashboard layout. */
function PageSkeleton() {
  return (
    <div className="space-y-[18px]">
      {/* header */}
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-[38px] w-20 rounded-[10px]" />
          <Skeleton className="h-[38px] w-24 rounded-[10px]" />
        </div>
      </div>
      {/* KSE strip */}
      <Skeleton className="h-[68px] w-full rounded-2xl" />
      {/* hero + allocation */}
      <div className="grid gap-[18px] lg:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-[300px] rounded-2xl" />
        <Skeleton className="h-[300px] rounded-2xl" />
      </div>
      {/* stat strip */}
      <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      {/* table */}
      <div className="rounded-2xl border border-line bg-card p-[22px] shadow-card">
        <Skeleton className="mb-4 h-5 w-32" />
        <TableSkeleton />
      </div>
    </div>
  );
}

export {
  Skeleton,
  CardSkeleton,
  RowSkeleton,
  TableSkeleton,
  ChartSkeleton,
  PageSkeleton,
};
