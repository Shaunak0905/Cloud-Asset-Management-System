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

export const ASSET_STATUSES = [
  "AVAILABLE",
  "IN_USE",
  "IN_MAINTENANCE",
  "DAMAGED",
  "LOST",
  "RETIRED",
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

// List/search/filter query (docs/06-asset-management.md #24-26). Every field
// falls back to "unset" on bad input rather than failing, since these come
// straight from user-editable URL params.
const optionalText = z.string().trim().min(1).max(200).optional().catch(undefined);

export const assetListQuerySchema = z.object({
  q: optionalText,
  status: z.enum(ASSET_STATUSES).optional().catch(undefined),
  category: optionalText,
  department: optionalText,
  buildingId: z.string().uuid().optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});

export type AssetListQuery = z.infer<typeof assetListQuerySchema>;

export function parseAssetListQuery(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): AssetListQuery {
  const get = (key: string) =>
    params instanceof URLSearchParams
      ? (params.get(key) ?? undefined)
      : [params[key]].flat()[0];
  return assetListQuerySchema.parse({
    q: get("q"),
    status: get("status"),
    category: get("category"),
    department: get("department"),
    buildingId: get("buildingId"),
    page: get("page"),
  });
}

// docs/06-asset-management.md #18: where the asset will be used, optional
// expected return, optional notes. `expectedReturnAt` must be a full ISO
// timestamp with an offset (the client converts its local datetime input with
// toISOString()) — a timezone-less value would be misread in the server's
// timezone.
export const assetRequestSchema = z.object({
  usageBuildingId: z.string().uuid(),
  usageRoomId: z.string().uuid(),
  expectedReturnAt: z
    .string()
    .datetime()
    .refine((v) => new Date(v).getTime() > Date.now(), {
      message: "Expected return must be in the future",
    })
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

export type AssetRequestInput = z.infer<typeof assetRequestSchema>;
