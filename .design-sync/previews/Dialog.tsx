import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "respondly";

export const Default = () => (
  <Dialog open modal={false}>
    <DialogContent showCloseButton={false}>
      <DialogHeader>
        <DialogTitle>Kişiyi düzenle</DialogTitle>
        <DialogDescription>
          Bu kişi WhatsApp üzerinden yazışmalarda bu isimle görünecek.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contact-name">Ad Soyad</Label>
          <Input id="contact-name" defaultValue="Ayşe Yılmaz" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contact-note">Not</Label>
          <Input id="contact-note" placeholder="Örn. tekrar eden misafir" />
        </div>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="outline">Vazgeç</Button>
        </DialogClose>
        <Button>Kaydet</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
