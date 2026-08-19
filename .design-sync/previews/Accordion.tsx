import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "respondly";

export const Default = () => (
  <Accordion type="single" collapsible defaultValue="rezervasyon" className="w-full max-w-md">
    <AccordionItem value="rezervasyon">
      <AccordionTrigger>Rezervasyonumu nasıl değiştiririm?</AccordionTrigger>
      <AccordionContent>
        Rezervasyon numaranızı yazmanız yeterli; uygun tarihleri kontrol edip
        değişikliği sizin için başlatıyoruz.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="giris">
      <AccordionTrigger>Giriş ve çıkış saatleri nedir?</AccordionTrigger>
      <AccordionContent>Giriş 14:00, çıkış 12:00'dir. Geç çıkış talebe bağlıdır.</AccordionContent>
    </AccordionItem>
    <AccordionItem value="evcil">
      <AccordionTrigger>Evcil hayvan kabul ediyor musunuz?</AccordionTrigger>
      <AccordionContent>10 kg altı evcil hayvanlar ek ücretle kabul edilir.</AccordionContent>
    </AccordionItem>
  </Accordion>
);
