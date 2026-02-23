export interface AgentInfo {
  id: number;
  name: string;
  owner: string;
  agentUri: string;
  vaultAddress: string;
  agentSigner: string;
  registeredAt: number;
  isActive: boolean;
  capabilities?: string[];
  pricing?: { amount: string; asset: string };
}
