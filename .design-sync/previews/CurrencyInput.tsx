import { CurrencyInput, Label } from "respondly";

export const Default = () => (
  <div className="grid w-56 gap-2">
    <Label htmlFor="rate">Gecelik fiyat</Label>
    <CurrencyInput id="rate" value={4500} onValueChange={() => {}} />
  </div>
);
