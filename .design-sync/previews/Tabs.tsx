import { Tabs, TabsContent, TabsList, TabsTrigger } from "respondly";

export const Default = () => (
  <Tabs defaultValue="konusmalar" className="w-full max-w-md">
    <TabsList>
      <TabsTrigger value="konusmalar">Konuşmalar</TabsTrigger>
      <TabsTrigger value="kisiler">Kişiler</TabsTrigger>
      <TabsTrigger value="sablonlar">Şablonlar</TabsTrigger>
    </TabsList>
    <TabsContent value="konusmalar" className="pt-3 text-sm text-muted-foreground">
      18 açık konuşma, 3'ü yanıt bekliyor.
    </TabsContent>
  </Tabs>
);

export const Line = () => (
  <Tabs defaultValue="genel" className="w-full max-w-md">
    <TabsList variant="line">
      <TabsTrigger value="genel">Genel</TabsTrigger>
      <TabsTrigger value="asistan">Asistan</TabsTrigger>
      <TabsTrigger value="yetkiler">Yetkiler</TabsTrigger>
    </TabsList>
    <TabsContent value="genel" className="pt-3 text-sm text-muted-foreground">
      Organizasyon adı, zaman dilimi ve dil ayarları.
    </TabsContent>
  </Tabs>
);
