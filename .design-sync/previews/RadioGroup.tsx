import { Label, RadioGroup, RadioGroupItem } from "respondly";

export const Default = () => (
  <RadioGroup defaultValue="asistan" className="gap-3">
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="asistan" />
      Asistan yanıtlasın
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="ekip" />
      Her zaman ekibe düşsün
    </Label>
    <Label className="flex items-center gap-2">
      <RadioGroupItem value="mesai" />
      Mesai dışında ekibe düşsün
    </Label>
  </RadioGroup>
);
