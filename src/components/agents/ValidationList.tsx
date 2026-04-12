"use client";
import { useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useValidation } from "@/hooks/useValidation";

interface ValidationListProps {
  agentId: number;
}

export function ValidationList({ agentId }: ValidationListProps) {
  const { validations, loading, loadValidations } = useValidation(agentId);

  useEffect(() => {
    loadValidations();
  }, [loadValidations]);

  if (loading) {
    return <div className="text-[var(--text-secondary)] text-sm">Loading validations...</div>;
  }

  if (validations.length === 0) {
    return <div className="text-[var(--text-secondary)] text-sm">No validations yet</div>;
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "Completed": return "success";
      case "Failed": return "default";
      default: return "info";
    }
  };

  return (
    <div className="space-y-2">
      {validations.map((v, i) => (
        <Card key={i} className="p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium">Request #{v.request_id}</span>
            <Badge variant={statusVariant(v.status)}>{v.status}</Badge>
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Validator: {v.validator.slice(0, 8)}...{v.validator.slice(-4)}
          </div>
          {v.evidence_uri && (
            <div className="text-xs text-[var(--text-secondary)] truncate mt-1">
              Evidence: {v.evidence_uri}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
