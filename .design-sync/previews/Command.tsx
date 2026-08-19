import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "respondly";
import { MessageSquare, Users, Wrench } from "lucide-react";

export const Default = () => (
  <Command className="w-full max-w-md rounded-xl border">
    <CommandInput placeholder="Komut veya kişi ara…" />
    <CommandList>
      <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
      <CommandGroup heading="Git">
        <CommandItem>
          <MessageSquare /> Gelen kutusu
          <CommandShortcut>⌘1</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <Users /> Kişiler
          <CommandShortcut>⌘2</CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Eylemler">
        <CommandItem>
          <Wrench /> MCP sunucusu ekle
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
);
