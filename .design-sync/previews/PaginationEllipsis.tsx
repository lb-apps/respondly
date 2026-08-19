import { PaginationEllipsis } from "respondly";

export const Default = () => (
  <div className="flex items-center gap-2 text-sm">
    <span>3</span>
    <PaginationEllipsis />
    <span>12</span>
  </div>
);
