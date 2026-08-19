import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "respondly";

export const Bottom = () => (
  <Drawer open modal={false}>
    <DrawerContent>
      <DrawerHeader>
        <DrawerTitle>Şablon seç</DrawerTitle>
        <DrawerDescription>
          Onaylı WhatsApp şablonlarından birini seçerek konuşmayı yeniden başlatın.
        </DrawerDescription>
      </DrawerHeader>
      <DrawerFooter>
        <Button>Devam et</Button>
        <Button variant="outline">Vazgeç</Button>
      </DrawerFooter>
    </DrawerContent>
  </Drawer>
);
