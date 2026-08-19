import { Label, QuantityInput } from "respondly";

export const Default = () => (
  <div className="grid w-40 gap-2">
    <Label htmlFor="guests">Misafir sayısı</Label>
    <QuantityInput id="guests" value={2} onValueChange={() => {}} />
  </div>
);
