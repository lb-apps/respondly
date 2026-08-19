import { Separator } from "respondly";

export const Horizontal = () => (
  <div className="w-full max-w-sm text-sm">
    <div className="pb-3 font-medium">Kanal ayarları</div>
    <Separator />
    <div className="pt-3 text-muted-foreground">WhatsApp Business numarası bağlı.</div>
  </div>
);

export const Vertical = () => (
  <div className="flex h-8 items-center gap-3 text-sm">
    <span>Konuşmalar</span>
    <Separator orientation="vertical" />
    <span>Kişiler</span>
    <Separator orientation="vertical" />
    <span>Şablonlar</span>
  </div>
);
