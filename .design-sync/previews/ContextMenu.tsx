import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "respondly";

export const Open = () => (
  <ContextMenu open modal={false}>
    <ContextMenuTrigger className="mt-48 ml-64 flex h-24 w-64 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
      Konuşmaya sağ tıklayın
    </ContextMenuTrigger>
    <ContextMenuContent className="w-52">
      <ContextMenuLabel>Konuşma</ContextMenuLabel>
      <ContextMenuItem>
        Devral
        <ContextMenuShortcut>⌘D</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>Okundu işaretle</ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">Arşivle</ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
);
