import { InputGroupButton } from "respondly";
import { Search } from "lucide-react";

export const Buttons = () => (
  <div className="flex items-center gap-2">
    <InputGroupButton>Bağlan</InputGroupButton>
    <InputGroupButton variant="outline">Test et</InputGroupButton>
    <InputGroupButton aria-label="Ara">
      <Search />
    </InputGroupButton>
  </div>
);
