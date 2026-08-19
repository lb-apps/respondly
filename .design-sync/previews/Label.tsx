import { Checkbox, Input, Label } from "respondly";

export const Default = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="display-name">Görünen ad</Label>
    <Input id="display-name" defaultValue="Dora Hotel" />
  </div>
);

export const WithCheckbox = () => (
  <Label className="flex items-center gap-2">
    <Checkbox defaultChecked />
    Yeni mesajlarda e-posta bildirimi gönder
  </Label>
);
