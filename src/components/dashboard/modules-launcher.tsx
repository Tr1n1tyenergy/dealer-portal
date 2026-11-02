"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Grid2x2, X } from "lucide-react";
import { visibleModules } from "@/lib/modules";
import type { StaffUser } from "@/lib/permissions";
import "./modules-launcher.css";

const TILE_STYLE: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: "4.35rem",
  height: "4.35rem",
  borderRadius: "1.15rem",
  background: "linear-gradient(165deg, #0d2466 0%, #071a45 55%, #051433 100%)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow:
    "0 10px 22px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12), inset 0 -1px 0 rgba(0, 0, 0, 0.35)",
};

const OVERLAY_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 9999,
  display: "grid",
  placeItems: "center",
  padding: "1.25rem",
};

const BACKDROP_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  border: 0,
  background: "rgba(7, 24, 51, 0.5)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  cursor: "pointer",
};

const PANEL_STYLE: CSSProperties = {
  position: "relative",
  zIndex: 1,
  width: "min(720px, 100%)",
  maxHeight: "min(72vh, 520px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: "22px",
  overflow: "hidden",
  color: "#fff",
  background: "linear-gradient(160deg, #1a4bb8 0%, #123a9e 35%, #0a2a78 70%, #071f5c 100%)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 32px 90px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.14)",
};

export function ModulesLauncher({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: StaffUser;
}) {
  const router = useRouter();
  const modules = visibleModules(user);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  function openModule(href: string) {
    onClose();
    router.push(href);
  }

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          style={OVERLAY_STYLE}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <button type="button" style={BACKDROP_STYLE} aria-label="Close" onClick={onClose} />

          <motion.div
            style={PANEL_STYLE}
            role="dialog"
            aria-modal="true"
            aria-label="Browse all modules"
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "1.05rem 1.25rem 0.4rem",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.55rem",
                  fontSize: "1.05rem",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  color: "#fff",
                }}
              >
                <Grid2x2 size={18} color="#F5B800" strokeWidth={2} />
                Modules
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modules"
                style={{
                  display: "grid",
                  placeItems: "center",
                  width: "1.85rem",
                  height: "1.85rem",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.18)",
                  background: "rgba(255,255,255,0.08)",
                  color: "rgba(255,255,255,0.9)",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div
              style={{
                padding: "0 1.25rem 0.95rem",
                fontSize: "0.78rem",
                color: "rgba(186, 205, 235, 0.78)",
              }}
            >
              Browse all Trinity Retail Intelligence modules
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0.25rem 1.15rem 1.15rem" }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(5.5rem, 1fr))",
                  gap: "1.1rem 0.65rem",
                  justifyItems: "center",
                  maxWidth: "100%",
                }}
              >
                {modules.map((mod) => {
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => openModule(mod.href)}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "0.55rem",
                        width: "100%",
                        maxWidth: "6.5rem",
                        padding: "0.55rem 0.3rem",
                        border: 0,
                        borderRadius: "1rem",
                        background: "transparent",
                        color: "#fff",
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      <span style={TILE_STYLE}>
                        <Icon size={28} color="#F5B800" strokeWidth={1.75} />
                      </span>
                      <span
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 600,
                          textAlign: "center",
                          lineHeight: 1.2,
                          color: "#fff",
                        }}
                      >
                        {mod.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
                padding: "0.8rem 1.25rem",
                borderTop: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(0,0,0,0.12)",
                fontSize: "0.72rem",
                color: "rgba(186, 205, 235, 0.72)",
              }}
            >
              <Link
                href="/intelligence/dashboard"
                onClick={onClose}
                style={{ color: "#f5b800", fontWeight: 700, textDecoration: "none" }}
              >
                Intelligence Suite
              </Link>
              <span>{modules.length} modules</span>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
