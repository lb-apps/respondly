import { Bubble, BubbleContent, BubbleGroup, BubbleReactions } from "respondly";

export const Variants = () => (
  <div className="flex w-full max-w-md flex-col gap-3">
    <Bubble variant="muted">
      <BubbleContent>Merhaba, giriş saatiniz kaçta?</BubbleContent>
    </Bubble>
    <Bubble align="end">
      <BubbleContent>Giriş 14:00, çıkış 12:00. Erken giriş için oda durumuna bakabilirim.</BubbleContent>
    </Bubble>
    <Bubble variant="tinted" align="end">
      <BubbleContent>Rezervasyonunuzu buldum: 12–16 Ağustos, Deluxe Oda.</BubbleContent>
    </Bubble>
    <Bubble variant="outline">
      <BubbleContent>Teşekkürler!</BubbleContent>
    </Bubble>
  </div>
);

export const WithReactions = () => (
  <BubbleGroup className="w-full max-w-md">
    <Bubble variant="muted" className="mb-4">
      <BubbleContent>Havuz saat kaça kadar açık?</BubbleContent>
      <BubbleReactions>👍</BubbleReactions>
    </Bubble>
  </BubbleGroup>
);
