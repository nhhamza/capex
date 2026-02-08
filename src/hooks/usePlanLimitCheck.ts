import { useState, useEffect } from "react";
import { useAuth } from "@/auth/authContext";

interface PlanLimits {
  free: number;
  solo: number;
  pro: number;
}

const PLAN_LIMITS: PlanLimits = {
  free: 1,
  solo: 5,
  pro: 20,
};

export function usePlanLimitCheck(currentPropertyCount: number) {
  const { userDoc } = useAuth();
  const [isAtLimit, setIsAtLimit] = useState(false);
  const [shouldShowUpgrade, setShouldShowUpgrade] = useState(false);
  const [suggestedPlan, setSuggestedPlan] = useState<"solo" | "pro" | null>(
    null,
  );

  const currentPlan = (userDoc?.plan || "free") as keyof PlanLimits;
  const currentLimit = PLAN_LIMITS[currentPlan];

  useEffect(() => {
    const atLimit = currentPropertyCount >= currentLimit;
    setIsAtLimit(atLimit);

    // Sugerir siguiente plan
    if (currentPlan === "free" && currentPropertyCount >= 1) {
      setSuggestedPlan("solo");
    } else if (currentPlan === "solo" && currentPropertyCount >= 5) {
      setSuggestedPlan("pro");
    }
  }, [currentPropertyCount, currentPlan, currentLimit]);

  const triggerUpgradeModal = () => {
    if (isAtLimit) {
      setShouldShowUpgrade(true);
    }
  };

  const closeUpgradeModal = () => {
    setShouldShowUpgrade(false);
  };

  return {
    isAtLimit,
    currentLimit,
    currentPlan,
    suggestedPlan,
    shouldShowUpgrade,
    triggerUpgradeModal,
    closeUpgradeModal,
  };
}
