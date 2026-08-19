import { Label, UnitQuantityInput } from "respondly";

export const Default = () => (
  <div className="grid w-56 gap-2">
    <Label htmlFor="nights">Konaklama</Label>
    <UnitQuantityInput id="nights" value={3} unitLabel="gece" onValueChange={() => {}} />
  </div>
);
