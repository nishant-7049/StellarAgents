import { getTxUrl } from "@/lib/stellar";

interface TxLinkProps {
  txHash: string;
  short?: boolean;
}

export function TxLink({ txHash, short = true }: TxLinkProps) {
  const display = short ? `${txHash.slice(0, 8)}...${txHash.slice(-8)}` : txHash;
  return (
    <a href={getTxUrl(txHash)} target="_blank" rel="noopener noreferrer"
       className="text-indigo-400 hover:text-indigo-300 underline text-sm font-mono">
      {display}
    </a>
  );
}
