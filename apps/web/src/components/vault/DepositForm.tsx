"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVault } from "@/hooks/useVault";

export function DepositForm() {
  const [amount, setAmount] = useState("");
  const { deposit, loading } = useVault();

  return (
    <Card>
      <h3 className="font-semibold mb-4">Deposit USDC</h3>
      <div className="flex gap-2">
        <Input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1" />
        <Button onClick={() => { deposit(parseFloat(amount)); setAmount(""); }} disabled={loading || !amount}>
          {loading ? "..." : "Deposit"}
        </Button>
      </div>
    </Card>
  );
}
