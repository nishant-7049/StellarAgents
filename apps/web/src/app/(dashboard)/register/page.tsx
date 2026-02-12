"use client";
import { RegisterForm } from "@/components/register/RegisterForm";

export default function RegisterPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Register Agent</h1>
        <p className="text-[var(--text-secondary)]">Register a new AI agent on the Stellar agent registry (ERC-8004)</p>
      </div>
      <div className="max-w-lg">
        <RegisterForm />
      </div>
    </div>
  );
}
