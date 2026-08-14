"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

interface Testimonial {
  quote: string
  author: string
  role: string
  company: string
  avatar: string
}

const DURATION = 8000

const testimonials: Testimonial[] = [
  {
    quote: "Misafirler artık gece yarısı bile saniyeler içinde yanıt alıyor. Oda müsaitliği, fiyat, kahvaltı saati… çoğu soru resepsiyona hiç ulaşmadan WhatsApp'ta çözülüyor. Ekibimiz sadece gerçekten önemli konulara odaklanıyor.",
    author: "Zeynep Aydın",
    role: "Genel Müdür",
    company: "Park Suites Hotel",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  },
  {
    quote: "Respondly soruları yanıtlarken doğrudan güncel müsaitliğe bağlı rezervasyon linkini gönderiyor. WhatsApp'tan gelen doğrudan rezervasyon oranımız belirgin şekilde arttı; komisyon ödemeden dolan odalar görüyoruz.",
    author: "Mehmet Yılmaz",
    role: "Satış Müdürü",
    company: "Grand Otel Antalya",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  },
  {
    quote: "Küçük bir ekiple koca oteli çeviriyoruz. Asistan rutin soruları üstleniyor, emin olmadığı anda konuşmayı bize devrediyor. Hiçbir misafir yanıtsız kalmıyor, biz de boğulmuyoruz.",
    author: "Ayşe Kara",
    role: "Otel Sahibi",
    company: "Sahil Resort",
    avatar: "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  },
  {
    quote: "Otelimizin tüm bilgisini bir kez yükledik; asistan artık politikalardan oda detaylarına kadar her şeyi tutarlı şekilde anlatıyor. Yanlış bilgi korkumuz kalmadı, çünkü bilmediğinde uyduruyor değil bize bağlanıyor.",
    author: "Burak Demir",
    role: "Operasyon Müdürü",
    company: "Blue Horizon Hotels",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  },
  {
    quote: "Uzaktan da olsam otelin tüm misafir konuşmalarını tek ekrandan görebiliyorum. Hangi soru gelmiş, asistan ne demiş, nerede devreye girmemiz gerekmiş… hepsi anlık. Respondly bu görünürlüğü tamamen değiştirdi.",
    author: "Selin Çelik",
    role: "Genel Koordinatör",
    company: "Aegean View Resort",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=faces&auto=format&q=80",
  },
]

export function TestimonialCarousel() {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIndex((prev) => (prev + 1) % testimonials.length)
    }, DURATION)
    return () => clearTimeout(timer)
  }, [index])

  const current = testimonials[index]

  return (
    <div className="flex flex-col gap-6">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="bg-card flex flex-col gap-5 rounded-2xl p-6 shadow-md"
        >
          <svg width="26" height="20" viewBox="0 0 20 16" fill="none" className="text-muted-foreground/20">
            <path
              d="M0 16V9.6C0 7.73333 0.3 6.1 0.9 4.7C1.53333 3.26667 2.36667 2.06667 3.4 1.1C4.46667 0.1 5.63333 -0.533333 6.9 -0.8L7.8 1.2C6.73333 1.6 5.8 2.3 5 3.3C4.23333 4.26667 3.78333 5.33333 3.65 6.5H8V16H0ZM12 16V9.6C12 7.73333 12.3 6.1 12.9 4.7C13.5333 3.26667 14.3667 2.06667 15.4 1.1C16.4667 0.1 17.6333 -0.533333 18.9 -0.8L19.8 1.2C18.7333 1.6 17.8 2.3 17 3.3C16.2333 4.26667 15.7833 5.33333 15.65 6.5H20V16H12Z"
              fill="currentColor"
            />
          </svg>

          <p className="line-clamp-3 text-base leading-relaxed text-foreground/70">
            {current.quote}
          </p>

          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current.avatar}
              alt={current.author}
              className="size-9 rounded-full object-cover"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{current.author}</p>
              <p className="text-sm font-medium text-muted-foreground">
                {current.role} · {current.company}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="flex justify-center gap-2.5">
        {testimonials.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            aria-label={`Referans ${i + 1}`}
            className={`relative overflow-hidden rounded-full bg-foreground/12 transition-all duration-300 ${
              i === index ? "h-[8px] w-[42px]" : "size-[8px]"
            }`}
          >
            {i === index && (
              <motion.span
                key={index}
                className="absolute inset-0 rounded-full bg-foreground"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: DURATION / 1000, ease: "linear" }}
                style={{ transformOrigin: "left" }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
