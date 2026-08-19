import { Button } from "respondly";
import { Check, Plus, Trash2 } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>Kaydet</Button>
    <Button variant="secondary">Taslak olarak kaydet</Button>
    <Button variant="outline">Önizle</Button>
    <Button variant="ghost">Vazgeç</Button>
    <Button variant="link">Daha fazla bilgi</Button>
    <Button variant="destructive">Sil</Button>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button size="xs">Çok küçük</Button>
    <Button size="sm">Küçük</Button>
    <Button size="default">Varsayılan</Button>
    <Button size="lg">Büyük</Button>
    <Button size="xl">Çok büyük</Button>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button>
      <Plus /> Yeni kişi
    </Button>
    <Button variant="outline">
      <Check /> Onayla
    </Button>
    <Button variant="destructive" size="icon" aria-label="Sil">
      <Trash2 />
    </Button>
  </div>
);

export const States = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Button loading>Gönderiliyor</Button>
    <Button disabled>Devre dışı</Button>
    <Button variant="outline" disabled>
      Devre dışı
    </Button>
  </div>
);
