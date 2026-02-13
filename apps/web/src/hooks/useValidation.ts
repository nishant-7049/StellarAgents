"use client";
import { useState, useCallback } from "react";
import { fetchValidations } from "@/lib/api";
import type { Validation } from "@/types/validation";

export function useValidation(agentId: number) {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadValidations = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    try {
      const data = await fetchValidations(agentId);
      setValidations(data.validations || []);
    } catch {
      setValidations([]);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  return { validations, loading, loadValidations };
}
