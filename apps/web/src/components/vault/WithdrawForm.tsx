"use client";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useVault } from "@/hooks/useVault";

export function WithdrawForm() {
  const [amount, setAmount] = useState("");
  const { withdraw, loading } = useVault();

  return (
    <Card>
      <h3 className="font-semibold mb-4">Withdraw USDC</h3>
      <div className="flex gap-2">
        <Input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} className="flex-1" />
        <Button variant="secondary" onClick={() => { withdraw(parseFloat(amount)); setAmount(""); }} disabled={loading || !amount}>
          {loading ? "..." : "Withdraw"}
        </Button>
      </div>
    </Card>
  );
}
