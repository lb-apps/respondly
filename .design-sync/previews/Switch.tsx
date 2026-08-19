import { Label, Switch } from "respondly";

export const States = () => (
  <div className="flex flex-col gap-3">
    <Label className="flex items-center gap-3">
      <Switch defaultChecked />
      Asistan açık
    </Label>
    <Label className="flex items-center gap-3">
      <Switch />
      Mesai dışı otomatik yanıt
    </Label>
    <Label className="flex items-center gap-3 opacity-60">
      <Switch disabled />
      Yorum izleme (yakında)
    </Label>
  </div>
);
