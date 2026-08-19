import { Label, Slider } from "respondly";

export const Single = () => (
  <div className="grid w-64 gap-3">
    <Label>Devralma eşiği</Label>
    <Slider defaultValue={[60]} max={100} step={5} />
  </div>
);

export const Range = () => (
  <div className="grid w-64 gap-3">
    <Label>Mesai saatleri</Label>
    <Slider defaultValue={[9, 18]} max={24} step={1} />
  </div>
);
