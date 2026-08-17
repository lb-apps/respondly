"use client"

import { WheelGesturesPlugin } from "embla-carousel-wheel-gestures"

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel"
import { RemoteImage } from "@/components/remote-image"
import { WhatsAppFormattedText } from "@/components/chat/whatsapp-formatted-text"
import type { CarouselCardView } from "@/lib/whatsapp/carousel-message"

/**
 * The swipeable strip of cards WhatsApp draws for `show_carousel`, one card per
 * option.
 *
 * Shared by the inbox and the assistant preview so a carousel looks the same
 * wherever it is read — the two had a copy each, identical down to the class
 * strings, which is exactly how a card ends up a different width on one surface
 * than the other. They differ only in what a card's buttons *do*: inert labels
 * on a message that has already been sent, real links and quick replies in the
 * preview. That is the one thing the caller supplies.
 */

/**
 * How wide a card is.
 *
 * Wide enough for the line under the title — "2 Misafir · 16 m²" — and a price
 * beside its strikethrough to survive without wrapping; narrow enough that the
 * next card still shows at the edge and the strip reads as scrollable.
 */
const CARD_BASIS = "basis-52"

export function CarouselCards({
  cards,
  renderButton,
}: {
  cards: CarouselCardView[]
  /** One card button. The surface decides whether it acts. */
  renderButton: (
    button: CarouselCardView["buttons"][number],
    card: CarouselCardView
  ) => React.ReactNode
}) {
  return (
    <Carousel
      opts={{ align: "start", dragFree: true, containScroll: "trimSnaps" }}
      // Embla moves a transform rather than scrolling a box, so a trackpad's
      // two-finger swipe — which the browser reports as a wheel event, not a
      // drag — did nothing at all here. This turns those events back into
      // movement, which is what everyone tries first on a strip of cards.
      plugins={[WheelGesturesPlugin({ forceWheelAxis: "x" })]}
      className="w-full min-w-0"
    >
      <CarouselContent className="-ml-2">
        {cards.map((card) => (
          <CarouselItem key={card.id} className={`${CARD_BASIS} pl-2`}>
            <div className="border-border flex h-full flex-col overflow-hidden rounded-2xl border">
              <RemoteImage
                src={card.imageUrl}
                className="h-24 w-full object-cover"
              />
              {card.body ? (
                <div className="bg-card text-card-foreground grow px-2.5 py-2 text-xs">
                  <WhatsAppFormattedText text={card.body} />
                </div>
              ) : null}
              {card.buttons.map((button) => renderButton(button, card))}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}
