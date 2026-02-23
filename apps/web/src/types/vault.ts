export interface VaultInfo {
  address: string;
  owner: string;
  balance: string;
  agentCount: number;
  totalSpent: string;
}

export interface AgentPolicy {
  agentAddress: string;
  dailyLimit: string;
  spentToday: string;
  isActive: boolean;
  remainingLimit: string;
}
