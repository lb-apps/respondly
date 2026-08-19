import { Alert, AlertAction, AlertDescription, AlertTitle, Button } from "respondly";
import { CircleAlert, Info } from "lucide-react";

export const Default = () => (
  <Alert className="max-w-lg">
    <Info />
    <AlertTitle>Şablon onayı bekleniyor</AlertTitle>
    <AlertDescription>
      Meta, gönderdiğiniz mesaj şablonunu inceliyor. Onaylanana kadar bu şablonla
      toplu gönderim yapılamaz.
    </AlertDescription>
  </Alert>
);

export const Destructive = () => (
  <Alert variant="destructive" className="max-w-lg">
    <CircleAlert />
    <AlertTitle>WhatsApp bağlantısı koptu</AlertTitle>
    <AlertDescription>
      Erişim anahtarının süresi doldu. Gelen mesajlar şu anda işlenmiyor.
    </AlertDescription>
  </Alert>
);

export const WithAction = () => (
  <Alert className="max-w-lg">
    <Info />
    <AlertTitle>Bilgi kütüphanesi güncellendi</AlertTitle>
    <AlertDescription>12 yeni belge asistana tanıtıldı.</AlertDescription>
    <AlertAction>
      <Button size="sm" variant="outline">
        İncele
      </Button>
    </AlertAction>
  </Alert>
);
