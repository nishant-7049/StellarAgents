import { Address, xdr } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

const rpc = new Server("https://soroban.stellar.org");
const FACTORY = "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM";

async function main() {
  try {
    const latestLedger = await rpc.getLatestLedger();
    console.log("Current ledger:", latestLedger.sequence);

    // Convert contract address (C...) to raw bytes using Address class
    const contractAddr = new Address(FACTORY);
    
    const contractDataKey = xdr.LedgerKey.contractData(
      new xdr.LedgerKeyContractData({
        contract: contractAddr.toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent(),
      })
    );

    const resp = await rpc.getLedgerEntries(contractDataKey);
    if (resp.entries && resp.entries.length > 0) {
      const entry = resp.entries[0];
      const liveUntil = entry.liveUntilLedgerSeq ?? 0;
      console.log("VaultFactory entry FOUND");
      console.log("Live until ledger:", liveUntil);
      console.log("Ledgers until expiry:", liveUntil - latestLedger.sequence);
      if (liveUntil <= latestLedger.sequence) {
        console.log("STATUS: EXPIRED - needs restore!");
      } else {
        console.log("STATUS: ALIVE");
      }
    } else {
      console.log("VaultFactory entry NOT FOUND — likely ARCHIVED/EXPIRED");
    }
  } catch (e: any) {
    console.error("Error:", e.message);
  }
}
main();
