import {
  Button,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "respondly";

export const Default = () => (
  <Popover open>
    <PopoverTrigger asChild>
      <Button variant="outline">Devralma kuralı</Button>
    </PopoverTrigger>
    <PopoverContent className="w-80">
      <PopoverHeader>
        <PopoverTitle>Asistan ne zaman devreder?</PopoverTitle>
        <PopoverDescription>
          Kaynak bulunamadığında veya misafir bir yetkili istediğinde konuşma ekibe düşer.
        </PopoverDescription>
      </PopoverHeader>
    </PopoverContent>
  </Popover>
);
