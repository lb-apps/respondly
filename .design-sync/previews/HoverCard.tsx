import { Avatar, AvatarFallback, HoverCard, HoverCardContent, HoverCardTrigger } from "respondly";

export const Default = () => (
  <HoverCard open>
    <HoverCardTrigger className="text-sm underline underline-offset-4">Ayşe Yılmaz</HoverCardTrigger>
    <HoverCardContent className="w-72">
      <div className="flex gap-3">
        <Avatar><AvatarFallback>AY</AvatarFallback></Avatar>
        <div className="grid gap-1 text-sm">
          <span className="font-medium">Ayşe Yılmaz</span>
          <span className="text-muted-foreground">+90 555 000 00 00</span>
          <span className="text-muted-foreground">3 konuşma · son giriş 12 Ağustos</span>
        </div>
      </div>
    </HoverCardContent>
  </HoverCard>
);
