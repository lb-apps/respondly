import {
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "respondly";

export const Default = () => (
  <Card className="max-w-sm">
    <CardHeader>
      <CardTitle>WhatsApp Business</CardTitle>
      <CardDescription>
        Numaranız Meta Cloud API üzerinden bağlı. Gelen mesajlar asistana
        iletiliyor.
      </CardDescription>
      <CardAction>
        <Badge variant="secondary">Bağlı</Badge>
      </CardAction>
    </CardHeader>
    <CardContent className="text-muted-foreground">
      +90 555 000 00 00 · Son senkronizasyon 2 dakika önce
    </CardContent>
    <CardFooter className="gap-2">
      <Button size="sm">Ayarları aç</Button>
      <Button size="sm" variant="ghost">
        Bağlantıyı kes
      </Button>
    </CardFooter>
  </Card>
);

export const Compact = () => (
  <Card size="sm" className="max-w-sm">
    <CardHeader>
      <CardTitle>Bekleyen konuşmalar</CardTitle>
      <CardDescription>Son 24 saat</CardDescription>
    </CardHeader>
    <CardContent className="text-2xl font-medium">18</CardContent>
  </Card>
);
