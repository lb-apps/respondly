import { Input, Label } from "respondly";

export const Default = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="org-name">Otel adı</Label>
    <Input id="org-name" defaultValue="Dora Hotel" />
  </div>
);

export const Placeholder = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="search">Kişi ara</Label>
    <Input id="search" placeholder="İsim veya numara" />
  </div>
);

export const Disabled = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="wa-number">WhatsApp numarası</Label>
    <Input id="wa-number" defaultValue="+90 555 000 00 00" disabled />
  </div>
);

export const Invalid = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="mail">E-posta</Label>
    <Input id="mail" defaultValue="ayse@" aria-invalid />
  </div>
);
