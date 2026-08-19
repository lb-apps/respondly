import { Kbd, KbdGroup } from "respondly";

export const Default = () => (
  <div className="flex flex-col gap-3 text-sm">
    <div className="flex items-center gap-2">
      <KbdGroup>
        <Kbd>⌘</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
      <span className="text-muted-foreground">Komut menüsünü aç</span>
    </div>
    <div className="flex items-center gap-2">
      <KbdGroup>
        <Kbd>⇧</Kbd>
        <Kbd>Enter</Kbd>
      </KbdGroup>
      <span className="text-muted-foreground">Yeni satır</span>
    </div>
  </div>
);
