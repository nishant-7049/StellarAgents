"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/motion";

export function CTASection() {
  return (
    <section className="py-24 px-6 bg-white">
      <div className="mx-auto max-w-3xl">
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="rounded-3xl bg-gradient-to-br from-[var(--accent)] to-[var(--brand-dark)] p-10 md:p-14 text-center shadow-xl shadow-[var(--accent)]/20"
        >
          <motion.div variants={fadeInUp}>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[13px] font-medium text-white mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Start in under 2 minutes
            </span>
          </motion.div>

          <motion.h2
            variants={fadeInUp}
            className="text-3xl sm:text-4xl font-bold text-white mb-4 leading-tight"
          >
            Your Portfolio Is Losing Yield
            <br />
            <span className="text-white/80">Every Minute You Wait</span>
          </motion.h2>

          <motion.p
            variants={fadeInUp}
            className="text-[16px] text-white/75 max-w-xl mx-auto mb-8 leading-relaxed"
          >
            Deploy your AI agent today. Connect your Freighter wallet, create a smart vault,
            and start earning up to 12.6% APY — fully autonomously, with no subscriptions
            and no lock-in.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex items-center justify-center gap-3 flex-wrap"
          >
            <Link
              href="/explorer"
              className="inline-flex items-center gap-2 bg-white text-[var(--accent)] font-semibold px-7 py-3.5 rounded-xl transition-all hover:bg-white/90 shadow-lg shadow-black/10 text-[15px]"
            >
              Explore Agents
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white font-semibold px-7 py-3.5 rounded-xl transition-all text-[15px]"
            >
              See Live Demo
            </Link>
          </motion.div>

          <motion.p variants={fadeInUp} className="mt-5 text-[12px] text-white/50">
            No subscription. No credit card. Testnet available for free experimentation.
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
