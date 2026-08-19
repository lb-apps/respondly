import { Checkbox, Label } from "respondly";

export const States = () => (
  <div className="flex flex-col gap-3">
    <Label className="flex items-center gap-2">
      <Checkbox defaultChecked />
      Asistan yanıtlarını otomatik gönder
    </Label>
    <Label className="flex items-center gap-2">
      <Checkbox />
      Devralma sonrası asistanı sustur
    </Label>
    <Label className="flex items-center gap-2 opacity-60">
      <Checkbox disabled />
      Yorum yanıtlama (yakında)
    </Label>
  </div>
);
