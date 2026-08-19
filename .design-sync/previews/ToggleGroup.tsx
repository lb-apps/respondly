import { ToggleGroup, ToggleGroupItem } from "respondly";

export const Single = () => (
  <ToggleGroup type="single" defaultValue="acik">
    <ToggleGroupItem value="tumu">Tümü</ToggleGroupItem>
    <ToggleGroupItem value="acik">Açık</ToggleGroupItem>
    <ToggleGroupItem value="kapali">Kapalı</ToggleGroupItem>
  </ToggleGroup>
);

export const Multiple = () => (
  <ToggleGroup type="multiple" defaultValue={["asistan"]}>
    <ToggleGroupItem value="asistan">Asistan</ToggleGroupItem>
    <ToggleGroupItem value="devralinan">Devralınan</ToggleGroupItem>
    <ToggleGroupItem value="okunmamis">Okunmamış</ToggleGroupItem>
  </ToggleGroup>
);
