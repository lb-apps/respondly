import { ScrollArea, Separator } from "respondly";

export const Default = () => (
  <ScrollArea className="h-48 w-64 rounded-xl border">
    <div className="p-3 text-sm">
      {["Oda tipleri", "Kahvaltı saatleri", "Havuz kuralları", "Spa randevusu", "Otopark", "Evcil hayvan politikası", "Geç çıkış", "Havaalanı transferi", "İptal koşulları", "Fatura talebi"].map((t) => (
        <div key={t}>
          <div className="py-2">{t}</div>
          <Separator />
        </div>
      ))}
    </div>
  </ScrollArea>
);
