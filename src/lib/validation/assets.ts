import { z } from "zod";

// Seed categories from docs/03-database-schema.md #22. `category` is plain
// text in the schema (not an enum) so this list is a UI convenience, not a
// hard constraint — the server only requires a non-empty string.
export const ASSET_CATEGORIES = [
  "Projector",
  "Laptop",
  "Desktop",
  "Camera",
  "Oscilloscope",
  "Networking Equipment",
  "Other",
] as const;

export const assetCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(100),
  serialNumber: z.string().trim().max(200).optional(),
  department: z.string().trim().max(200).optional(),
  registeredBuildingId: z.string().uuid(),
  registeredRoomId: z.string().uuid(),
  purchaseDate: z.string().date().optional(),
  warrantyUntil: z.string().date().optional(),
  description: z.string().trim().max(2000).optional(),
});

export const assetUpdateSchema = assetCreateSchema.partial();

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
