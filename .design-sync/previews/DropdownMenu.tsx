import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "respondly";
import { Archive, BellOff, UserRound } from "lucide-react";

export const Default = () => (
  <DropdownMenu open modal={false}>
    <DropdownMenuTrigger asChild>
      <Button variant="outline">Konuşma işlemleri</Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" className="w-56">
      <DropdownMenuLabel>Konuşma</DropdownMenuLabel>
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <UserRound /> Devral
          <DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <BellOff /> Bildirimleri sustur
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        <Archive /> Arşivle
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);
