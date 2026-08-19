import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "respondly";

const ROOMS = ["Deluxe Oda", "Aile Suiti", "Deniz Manzaralı Oda", "Standart Oda"];

export const Open = () => (
  <div className="w-72 pt-2">
    <Combobox items={ROOMS} open>
      <ComboboxInput placeholder="Oda tipi ara" />
      <ComboboxContent>
        <ComboboxEmpty>Sonuç yok.</ComboboxEmpty>
        <ComboboxList>
          {(room: string) => (
            <ComboboxItem key={room} value={room}>
              {room}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
);
