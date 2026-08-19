import { Skeleton } from "respondly";

export const ConversationRow = () => (
  <div className="flex w-full max-w-sm items-center gap-3">
    <Skeleton className="size-8 rounded-full" />
    <div className="grid flex-1 gap-2">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
  </div>
);

export const Block = () => (
  <div className="grid w-full max-w-sm gap-2">
    <Skeleton className="h-24 w-full rounded-xl" />
    <Skeleton className="h-3 w-40" />
    <Skeleton className="h-3 w-24" />
  </div>
);
