import { Label, Textarea } from "respondly";

export const Default = () => (
  <div className="grid max-w-md gap-2">
    <Label htmlFor="greeting">Karşılama mesajı</Label>
    <Textarea
      id="greeting"
      rows={4}
      defaultValue="Merhaba! Dora Hotel'e hoş geldiniz. Rezervasyon, oda ve hizmetlerimizle ilgili sorularınızı buradan yanıtlayabilirim."
    />
  </div>
);

export const Placeholder = () => (
  <div className="grid max-w-md gap-2">
    <Label htmlFor="note">Kişi notu</Label>
    <Textarea id="note" rows={3} placeholder="Bu kişiyle ilgili ekibin bilmesi gerekenler…" />
  </div>
);
