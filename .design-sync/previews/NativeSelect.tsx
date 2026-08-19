import { Label, NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "respondly";

export const Default = () => (
  <div className="grid w-64 gap-2">
    <Label htmlFor="lang">Asistan dili</Label>
    <NativeSelect id="lang" defaultValue="tr">
      <NativeSelectOptGroup label="Sık kullanılan">
        <NativeSelectOption value="tr">Türkçe</NativeSelectOption>
        <NativeSelectOption value="en">İngilizce</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Diğer">
        <NativeSelectOption value="de">Almanca</NativeSelectOption>
        <NativeSelectOption value="ru">Rusça</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  </div>
);
