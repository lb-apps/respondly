import { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount } from "respondly";

export const Sizes = () => (
  <div className="flex items-center gap-4">
    <Avatar size="sm">
      <AvatarFallback>AY</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>MK</AvatarFallback>
    </Avatar>
    <Avatar size="lg">
      <AvatarFallback>ZD</AvatarFallback>
    </Avatar>
  </div>
);

export const WithBadge = () => (
  <Avatar size="lg">
    <AvatarFallback>AY</AvatarFallback>
    <AvatarBadge className="bg-primary" />
  </Avatar>
);

export const Group = () => (
  <AvatarGroup>
    <Avatar>
      <AvatarFallback>AY</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>MK</AvatarFallback>
    </Avatar>
    <Avatar>
      <AvatarFallback>ZD</AvatarFallback>
    </Avatar>
    <AvatarGroupCount>+4</AvatarGroupCount>
  </AvatarGroup>
);
