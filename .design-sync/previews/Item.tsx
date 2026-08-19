import {
  Avatar,
  AvatarFallback,
  Badge,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "respondly";

export const Variants = () => (
  <ItemGroup className="max-w-md">
    <Item>
      <ItemMedia>
        <Avatar><AvatarFallback>AY</AvatarFallback></Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Ayşe Yılmaz</ItemTitle>
        <ItemDescription>Giriş saatini sordu · 2 dk önce</ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="secondary">Asistan</Badge>
      </ItemActions>
    </Item>
    <Item variant="outline">
      <ItemMedia>
        <Avatar><AvatarFallback>MK</AvatarFallback></Avatar>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>Mehmet Kaya</ItemTitle>
        <ItemDescription>Fatura talebi · 18 dk önce</ItemDescription>
      </ItemContent>
    </Item>
    <Item variant="muted" size="sm">
      <ItemContent>
        <ItemTitle>Zeynep Demir</ItemTitle>
        <ItemDescription>Konuşma kapatıldı</ItemDescription>
      </ItemContent>
    </Item>
  </ItemGroup>
);
