import { AspectRatio } from "respondly";

export const Ratios = () => (
  <div className="flex w-full max-w-md gap-4">
    <div className="flex-1">
      <AspectRatio ratio={16 / 9} className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
        16 : 9
      </AspectRatio>
    </div>
    <div className="flex-1">
      <AspectRatio ratio={1} className="flex items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
        1 : 1
      </AspectRatio>
    </div>
  </div>
);
