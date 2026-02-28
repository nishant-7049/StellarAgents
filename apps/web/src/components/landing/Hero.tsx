"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export function Hero() {
  return (
    <section
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(6,100,160,0.55) 0%, transparent 60%)," +
          "linear-gradient(180deg, #010c1e 0%, #021b3a 35%, #032d5c 65%, #043d73 100%)",
      }}
    >
      {/* Light rays from surface */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 40% at 50% -5%, rgba(30,140,255,0.18) 0%, transparent 70%)",
        }}
      />

      {/* Floating bubbles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[
          { left: "12%", top: "70%", size: 3, delay: "0s",   dur: "8s"  },
          { left: "25%", top: "80%", size: 2, delay: "2s",   dur: "10s" },
          { left: "45%", top: "90%", size: 4, delay: "1s",   dur: "7s"  },
          { left: "60%", top: "75%", size: 2, delay: "3s",   dur: "9s"  },
          { left: "78%", top: "85%", size: 3, delay: "0.5s", dur: "11s" },
          { left: "88%", top: "65%", size: 2, delay: "4s",   dur: "8s"  },
        ].map((b, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white/20"
            style={{
              left: b.left,
              top: b.top,
              width: b.size,
              height: b.size,
              animation: `bubbleRise ${b.dur} ${b.delay} infinite linear`,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-2xl">
        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="text-4xl sm:text-5xl lg:text-[58px] font-bold text-white tracking-tight leading-[1.1]"
        >
          Launch AI agents
          <br />
          <span style={{ color: "#60b4ff" }}>with on-chain trust.</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.28, ease: "easeOut" }}
          className="mt-5 text-[16px] text-white/55 max-w-lg leading-relaxed"
        >
          Register identity, run autonomous payments, and connect DeFi actions
          in one simple stack on Stellar.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          className="mt-8 flex items-center gap-3 flex-wrap justify-center"
        >
          <Link
            href="/explorer"
            className="inline-flex items-center gap-2 bg-white text-[#032d5c] font-semibold px-6 py-3 rounded-xl text-[15px] hover:bg-white/90 transition-colors shadow-lg shadow-black/20"
          >
            Get started free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-semibold px-6 py-3 rounded-xl text-[15px] transition-colors"
          >
            See live demo
          </Link>
        </motion.div>

        {/* Stats strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-11 flex items-center gap-6 text-[13px] flex-wrap justify-center"
        >
          {[
            ["ERC-8004", "agent identity"],
            ["x402", "micropayments"],
            ["Soroban", "smart contracts"],
          ].map(([val, label], i) => (
            <span key={i} className="flex items-center gap-1.5">
              <strong className="text-white/70 font-semibold">{val}</strong>
              <span className="text-white/35">{label}</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5"
      >
        <span className="text-[10px] text-white/25 tracking-widest uppercase">scroll</span>
        <div className="w-px h-7 bg-gradient-to-b from-white/25 to-transparent" />
      </motion.div>

      <style jsx>{`
        @keyframes bubbleRise {
          0%   { transform: translateY(0);    opacity: 0.3; }
          60%  { opacity: 0.15; }
          100% { transform: translateY(-80vh); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
