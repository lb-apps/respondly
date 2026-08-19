import { Button, Collapsible, CollapsibleContent, CollapsibleTrigger } from "respondly";
import { ChevronsUpDown } from "lucide-react";

export const Open = () => (
  <Collapsible defaultOpen className="w-full max-w-sm">
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">Gelişmiş asistan ayarları</span>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Aç/kapat">
          <ChevronsUpDown />
        </Button>
      </CollapsibleTrigger>
    </div>
    <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
      Devralma eşiği, yanıt uzunluğu ve kaynak gösterme davranışı bu bölümde ayarlanır.
    </CollapsibleContent>
  </Collapsible>
);
