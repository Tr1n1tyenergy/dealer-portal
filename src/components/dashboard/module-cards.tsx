"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Grid2x2 } from "lucide-react";
import { FEATURED_MODULES, visibleModules } from "@/lib/modules";
import { ModulesLauncher } from "@/components/dashboard/modules-launcher";
import "./modules.css";
import "./modules-launcher.css";

export function ModuleCards({ role }: { role: string }) {
  const [launcherOpen, setLauncherOpen] = useState(false);
  const visible = new Set(visibleModules(role).map((m) => m.id));
  const featured = FEATURED_MODULES.filter((m) => visible.has(m.id));

  return (
    <>
      <div className="mod-grid">
        {featured.map((mod, index) => {
          const Icon = mod.icon;
          return (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
            >
              <Link href={mod.href} className="mod-card">
                <span className="mod-card__accent" aria-hidden />

                <div className="mod-card__body">
                  <div className="mod-card__top">
                    <div className="mod-card__icon" style={{ color: "#F5B800" }}>
                      <Icon color="#F5B800" size={20} strokeWidth={2} />
                    </div>
                    <div className="mod-card__heading">
                      <h3 className="mod-card__title">{mod.title}</h3>
                      <div className="mod-card__tag">{mod.tagline}</div>
                      <p className="mod-card__desc">{mod.description}</p>
                    </div>
                  </div>

                  <hr className="mod-card__divider" />

                  <ul className="mod-card__list">
                    {mod.features.map((feature) => (
                      <li key={feature}>
                        <span className="mod-card__check">
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <div className="mod-card__cta">
                    Open Module
                    <ArrowRight size={16} />
                  </div>
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Under the third / rightmost module */}
      <div className="mod-browse-row">
        <button
          type="button"
          className="mod-browse-btn"
          onClick={() => setLauncherOpen(true)}
        >
          <Grid2x2 size={15} color="#173D8F" />
          Browse all modules
        </button>
      </div>

      <ModulesLauncher open={launcherOpen} onClose={() => setLauncherOpen(false)} role={role} />
    </>
  );
}
