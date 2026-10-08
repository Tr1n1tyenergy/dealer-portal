"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowUpRight, FileSpreadsheet, Mic, Presentation } from "lucide-react";

const icons = {
  reports: FileSpreadsheet,
  "note-taker": Mic,
  presentations: Presentation,
} as const;

export type FeatureIcon = keyof typeof icons;

export function FeatureCard({
  title,
  description,
  href,
  icon,
}: {
  title: string;
  description: string;
  href: string;
  icon: FeatureIcon;
}) {
  const Icon = icons[icon];

  return (
    <motion.div whileHover={{ y: -4, scale: 1.01 }} transition={{ type: "spring", stiffness: 320, damping: 22 }}>
      <Link
        href={href}
        className="card-premium group block overflow-hidden border border-transparent transition hover:border-trinity-gold/30 hover:shadow-[0_18px_40px_rgba(23,61,143,0.12)]"
      >
        <div className="h-1 w-full bg-gradient-to-r from-trinity-gold via-[#ffd666] to-trinity-blue" />
        <div className="p-6">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[#fff6d6] text-trinity-blue">
            <Icon className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-black text-trinity-navy">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{description}</p>
          <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-trinity-blue">
            Open module
            <ArrowUpRight className="h-4 w-4 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
