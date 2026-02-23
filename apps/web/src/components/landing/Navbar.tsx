"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const base = "fixed top-0 inset-x-0 z-50 transition-all duration-300";
  const style = scrolled
    ? "bg-white/95 backdrop-blur border-b border-[var(--border)] shadow-sm"
    : "bg-transparent";
  const textColor = scrolled ? "text-[var(--text-secondary)]" : "text-white/70";
  const textHover = scrolled ? "hover:text-[var(--text-primary)]" : "hover:text-white";

  return (
    <nav className={`${base} ${style}`}>
      <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center">
          <Image src="/logo.png" alt="AgenticOcean" width={52} height={52} className="object-contain" />
        </Link>

        <div className={`hidden md:flex items-center gap-8 text-[13.5px] font-medium ${textColor}`}>
          <a href="#how-it-works" className={`transition-colors ${textHover}`}>How it works</a>
          <a href="#features" className={`transition-colors ${textHover}`}>Features</a>
          <Link href="/credits" className={`transition-colors ${textHover}`}>Pricing</Link>
          <a href="https://agenticoceandocs.vercel.app/" target="_blank" rel="noopener noreferrer" className={`transition-colors ${textHover}`}>Docs</a>
        </div>

        <div className="hidden md:flex items-center gap-2.5">
          <Link href="/explorer" className={`text-[13px] font-medium px-3.5 py-1.5 rounded-lg transition-colors ${textColor} ${textHover} ${!scrolled ? "hover:bg-white/10" : "hover:bg-[var(--surface1)]"}`}>
            Browse Agents
          </Link>
          <Link href="/vault" className={`text-[13px] font-semibold px-4 py-1.5 rounded-lg transition-all ${scrolled ? "bg-[var(--accent)] text-white hover:bg-[var(--brand-dark)]" : "bg-white text-[#032d5c] hover:bg-white/90"}`}>
            Launch App →
          </Link>
        </div>

        <button className={`md:hidden p-1 ${textColor}`} onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-white border-b border-[var(--border)] px-6 pb-5 pt-2">
          {[
            { label: "How it works", href: "#how-it-works", external: false },
            { label: "Features",     href: "#features",     external: false },
            { label: "Pricing",      href: "/credits",      external: false },
            { label: "Docs",         href: "https://agenticoceandocs.vercel.app/", external: true },
          ].map(l => (
            <Link key={l.label} href={l.href}
              target={l.external ? "_blank" : undefined}
              rel={l.external ? "noopener noreferrer" : undefined}
              onClick={() => setOpen(false)}
              className="block text-[14px] text-[var(--text-secondary)] py-3 border-b border-[var(--border)] last:border-0">
              {l.label}
            </Link>
          ))}
          <Link href="/vault" onClick={() => setOpen(false)}
            className="block mt-3 text-center text-[14px] font-semibold bg-[var(--accent)] text-white py-2.5 rounded-xl">
            Launch App →
          </Link>
        </div>
      )}
    </nav>
  );
}
