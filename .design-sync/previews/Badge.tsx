import { Badge } from "respondly";
import { Check, Clock } from "lucide-react";

export const Variants = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge>Yeni</Badge>
    <Badge variant="secondary">Beklemede</Badge>
    <Badge variant="destructive">Başarısız</Badge>
    <Badge variant="outline">Taslak</Badge>
    <Badge variant="ghost">Arşiv</Badge>
    <Badge variant="link">Detay</Badge>
  </div>
);

export const WithIcons = () => (
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="secondary">
      <Check /> Teslim edildi
    </Badge>
    <Badge variant="outline">
      <Clock /> Yanıt bekliyor
    </Badge>
  </div>
);
