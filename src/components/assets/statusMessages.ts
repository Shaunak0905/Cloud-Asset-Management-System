import type { AssetStatus } from "@prisma/client";

// Public-safe explanations of each status (docs/07-qr-system.md #20-22).
// Deliberately says nothing about who has it or what's wrong with it.
export const STATUS_MESSAGES: Record<AssetStatus, string> = {
  AVAILABLE: "Available to request.",
  IN_USE: "Currently in use.",
  IN_MAINTENANCE: "Currently under maintenance.",
  DAMAGED: "Reported damaged — awaiting maintenance.",
  LOST: "Reported lost.",
  RETIRED: "This asset is no longer available for use.",
};
