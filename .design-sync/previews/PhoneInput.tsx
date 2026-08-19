import { Label, PhoneInput } from "respondly";

export const Default = () => (
  <div className="grid w-72 gap-2">
    <Label htmlFor="phone">WhatsApp numarası</Label>
    <PhoneInput id="phone" defaultCountry="TR" value="+905550000000" onChange={() => {}} />
  </div>
);
