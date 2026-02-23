import { Address, xdr } from "@stellar/stellar-sdk";
import { Server } from "@stellar/stellar-sdk/rpc";

const rpc = new Server("https://soroban.stellar.org");

const CONTRACTS: Record<string, string> = {
  VaultFactory: "CAXYXFBO26RSBU2HRNPDWOQ7M2WITX67E7PI543WHDDMM5F7U4WQOUXM",
  AgentRegistry: "CDKHR3UUKCKXJ6CRKWKUZI3SKWAAKJMU6TGHRBM2VJJBCKEO6ETH55AU",
  ReputationRegistry: "CB6B4EBQ3JXLGUWF5WGMQV63PL3K2WQP5LMEL2BZDIDTEPCIC5BDH6ZB",
  ValidationRegistry: "CDX65CKW2NZQZK5U7DQRK6KVOBI4PTLQVGHYAEQ7OPPY2KRCDUAS2AL5",
};

async function checkContract(name: string, address: string, currentLedger: number) {
  const contractAddr = new Address(address);
  const key = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contractAddr.toScAddress(),
      key: xdr.ScVal.scvLedgerKeyContractInstance(),
      durability: xdr.ContractDataDurability.persistent(),
    })
  );
  const resp = await rpc.getLedgerEntries(key);
  if (resp.entries && resp.entries.length > 0) {
    const liveUntil = resp.entries[0].liveUntilLedgerSeq ?? 0;
    const status = liveUntil > currentLedger ? "ALIVE" : "EXPIRED";
    console.log(`${name}: ${status} (live until ${liveUntil}, current ${currentLedger})`);
  } else {
    console.log(`${name}: NOT FOUND`);
  }
}

async function main() {
  const latestLedger = await rpc.getLatestLedger();
  const current = latestLedger.sequence;
  console.log("Current ledger:", current);
  for (const [name, addr] of Object.entries(CONTRACTS)) {
    await checkContract(name, addr, current);
  }
}
main().catch(console.error);
