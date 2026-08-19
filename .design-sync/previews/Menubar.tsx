import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "respondly";

export const Default = () => (
  <Menubar>
    <MenubarMenu>
      <MenubarTrigger>Konuşma</MenubarTrigger>
      <MenubarContent>
        <MenubarItem>
          Devral <MenubarShortcut>⌘D</MenubarShortcut>
        </MenubarItem>
        <MenubarItem>Etiket ekle</MenubarItem>
        <MenubarSeparator />
        <MenubarItem>Arşivle</MenubarItem>
      </MenubarContent>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Görünüm</MenubarTrigger>
    </MenubarMenu>
    <MenubarMenu>
      <MenubarTrigger>Yardım</MenubarTrigger>
    </MenubarMenu>
  </Menubar>
);
