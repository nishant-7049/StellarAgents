"use client";
import { motion, AnimatePresence } from "framer-motion";
import { ReactNode } from "react";
import { Check } from "lucide-react";

interface Step {
  label: string;
  content: ReactNode;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
}

export function Stepper({ steps, currentStep }: StepperProps) {
  return (
    <div className="space-y-6">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center">
            <div className="flex items-center gap-2">
              <div className="relative">
                {i < currentStep ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
                  >
                    <Check className="w-4 h-4 text-white" />
                  </motion.div>
                ) : i === currentStep ? (
                  <div className="relative">
                    <motion.div
                      animate={{ boxShadow: ["0 0 0 0 rgba(99,102,241,0.4)", "0 0 0 10px rgba(99,102,241,0)", "0 0 0 0 rgba(99,102,241,0)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold"
                    >
                      {i + 1}
                    </motion.div>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full border border-[var(--border)] flex items-center justify-center text-[var(--text-secondary)] text-sm">
                    {i + 1}
                  </div>
                )}
              </div>
              <span className={`text-sm hidden sm:inline ${i <= currentStep ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"}`}>
                {step.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-8 h-px mx-2 ${i < currentStep ? "bg-green-500" : "bg-[var(--border)]"}`} />
            )}
          </div>
        ))}
      </div>

      {/* Step content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {steps[currentStep]?.content}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
