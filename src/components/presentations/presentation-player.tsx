"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PresentationSlide } from "@/lib/notes";

export function PresentationPlayer({
  title,
  slides,
}: {
  title: string;
  slides: PresentationSlide[];
}) {
  const [index, setIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const router = useRouter();
  const slide = slides[index];

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        setIndex((i) => Math.min(slides.length - 1, i + 1));
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => Math.max(0, i - 1));
      }
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slides.length]);

  const content = (
    <div className={fullscreen ? "fixed inset-0 z-50 bg-trinity-navy p-6 md:p-10" : "card-premium overflow-hidden"}>
      <div className={`relative ${fullscreen ? "h-full" : "min-h-[480px]"} rounded-[24px] bg-gradient-to-br from-white to-[#f8fafc] p-8 md:p-12`}>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.16em] text-trinity-gold">
              {title}
            </div>
            <div className="mt-1 text-sm text-slate-500">
              Slide {index + 1} of {slides.length}
            </div>
          </div>
          <div className="flex gap-2">
            {!fullscreen ? (
              <Button variant="outline" size="sm" onClick={() => setFullscreen(true)}>
                <Maximize2 className="h-4 w-4" /> Fullscreen
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setFullscreen(false)}>
                <X className="h-4 w-4" /> Exit
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-trinity-gold to-trinity-blue transition-all"
            style={{ width: `${((index + 1) / slides.length) * 100}%` }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
            className="mt-8"
          >
            <h2 className="text-4xl font-black text-trinity-navy md:text-5xl">{slide.title}</h2>
            {slide.subtitle ? (
              <p className="mt-3 text-lg text-slate-500">{slide.subtitle}</p>
            ) : null}
            <ul className="mt-8 space-y-3">
              {slide.bullets.map((b) => (
                <li key={b} className="flex gap-3 text-lg text-slate-700">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-trinity-gold" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between">
          <Button
            variant="outline"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          <Button
            disabled={index === slides.length - 1}
            onClick={() => setIndex((i) => Math.min(slides.length - 1, i + 1))}
          >
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!fullscreen ? (
        <div className="border-t border-black/5 px-6 py-4">
          <Button variant="ghost" onClick={() => router.push("/intelligence/presentations")}>
            Back to Presentations
          </Button>
        </div>
      ) : null}
    </div>
  );

  return content;
}
