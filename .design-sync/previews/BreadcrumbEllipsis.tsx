import { BreadcrumbEllipsis } from "respondly";

export const Default = () => (
  <div className="flex items-center gap-2 text-sm text-muted-foreground">
    <span>Dora Hotel</span>
    <BreadcrumbEllipsis />
    <span>Oda tipleri</span>
  </div>
);
