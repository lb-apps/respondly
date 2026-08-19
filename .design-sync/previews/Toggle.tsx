import { Toggle } from "respondly";
import { Bold, Italic } from "lucide-react";

export const Default = () => (
  <div className="flex items-center gap-2">
    <Toggle aria-label="Kalın"><Bold /></Toggle>
    <Toggle defaultPressed aria-label="İtalik"><Italic /></Toggle>
    <Toggle disabled aria-label="Devre dışı"><Bold /></Toggle>
  </div>
);
