import {
  Button,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "respondly";

export const RightPanel = () => (
  <Sheet open modal={false}>
    <SheetContent side="right">
      <SheetHeader>
        <SheetTitle>Kişi detayı</SheetTitle>
        <SheetDescription>WhatsApp üzerinden gelen kişi bilgileri.</SheetDescription>
      </SheetHeader>
      <div className="grid gap-4 px-4">
        <div className="grid gap-2">
          <Label htmlFor="sheet-name">Ad Soyad</Label>
          <Input id="sheet-name" defaultValue="Ayşe Yılmaz" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sheet-phone">Telefon</Label>
          <Input id="sheet-phone" defaultValue="+90 555 000 00 00" readOnly />
        </div>
      </div>
      <SheetFooter>
        <Button>Kaydet</Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
);
