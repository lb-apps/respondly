import {
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "respondly";

export const Closed = () => (
  <div className="grid w-64 gap-2">
    <Label>Konuşma durumu</Label>
    <Select defaultValue="asistan">
      <SelectTrigger>
        <SelectValue placeholder="Seçiniz" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="asistan">Asistan yanıtlıyor</SelectItem>
        <SelectItem value="devralindi">Devralındı</SelectItem>
        <SelectItem value="kapali">Kapalı</SelectItem>
      </SelectContent>
    </Select>
  </div>
);

// The open list positions itself over the trigger, so the cell needs headroom
// above it for the label to stay visible.
export const Open = () => (
  <div className="grid w-64 gap-2 pt-40">
    <Label>Konuşma durumu</Label>
    <Select open defaultValue="asistan">
      <SelectTrigger>
        <SelectValue placeholder="Seçiniz" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Durum</SelectLabel>
          <SelectItem value="asistan">Asistan yanıtlıyor</SelectItem>
          <SelectItem value="devralindi">Devralındı</SelectItem>
          <SelectItem value="kapali">Kapalı</SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
);
