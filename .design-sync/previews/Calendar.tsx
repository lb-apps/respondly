import { Calendar } from "respondly";

export const Default = () => (
  <Calendar mode="single" defaultMonth={new Date(2026, 7, 1)} selected={new Date(2026, 7, 18)} className="rounded-xl border" />
);

export const Range = () => (
  <Calendar
    mode="range"
    defaultMonth={new Date(2026, 7, 1)}
    selected={{ from: new Date(2026, 7, 12), to: new Date(2026, 7, 16) }}
    className="rounded-xl border"
  />
);
