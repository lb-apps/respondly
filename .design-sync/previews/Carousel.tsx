import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "respondly";

export const Default = () => (
  <Carousel className="w-full max-w-sm">
    <CarouselContent>
      {["Deluxe Oda", "Aile Suiti", "Deniz Manzaralı"].map((t) => (
        <CarouselItem key={t} className="basis-1/2">
          <div className="flex h-28 items-center justify-center rounded-xl bg-muted text-sm">{t}</div>
        </CarouselItem>
      ))}
    </CarouselContent>
    <CarouselPrevious />
    <CarouselNext />
  </Carousel>
);
