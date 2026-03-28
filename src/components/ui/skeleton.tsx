import { cn } from "@/lib/utils";

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-700", className)}
      {...props}
    />
  );
}

function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-5 space-y-3", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

function RowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === 0 ? "w-20" : i === 1 ? "w-32 flex-1" : "w-16")}
        />
      ))}
    </div>
  );
}

function TableSkeleton({ rows = 6, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} columns={columns} />
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6 animate-in-up">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
      <div className="rounded-2xl border border-border/50 p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        <TableSkeleton />
      </div>
    </div>
  );
}

export { Skeleton, CardSkeleton, RowSkeleton, TableSkeleton, PageSkeleton };
