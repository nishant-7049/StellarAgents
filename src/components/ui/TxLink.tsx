import { getTxUrl } from "@/lib/stellar";

interface TxLinkProps {
  hash?: string;
  txHash?: string;
  short?: boolean;
  className?: string;
}

export function TxLink({ hash, txHash, short = true, className = "" }: TxLinkProps) {
  const tx = hash || txHash;

  if (!tx) {
    return null;
  }

  const display = short && tx.length > 16 ? `${tx.slice(0, 8)}...${tx.slice(-8)}` : tx;
  return (
    <a href={getTxUrl(tx)} target="_blank" rel="noopener noreferrer"
       className={`text-indigo-400 hover:text-indigo-300 underline text-sm font-mono ${className}`}>
      {display}
    </a>
  );
}
