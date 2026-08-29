import { z } from "zod";

export const buildingCreateSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional(),
});

export const roomCreateSchema = z.object({
  buildingId: z.string().uuid(),
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(200),
  floor: z.coerce.number().int().optional(),
});

export type BuildingCreateInput = z.infer<typeof buildingCreateSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
