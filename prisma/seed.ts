import { PrismaClient } from "@prisma/client";

// docs/03-database-schema.md #22. Uses upsert on the natural unique key so
// re-running this is idempotent.
const prisma = new PrismaClient();

const BUILDINGS = [
  {
    code: "VY",
    name: "Vyas",
    rooms: [
      { code: "VY001", name: "VY001", floor: 0 },
      { code: "VY101", name: "VY101", floor: 1 },
    ],
  },
  {
    code: "VK",
    name: "Vivekananda",
    rooms: [
      { code: "VK301", name: "VK301", floor: 3 },
      { code: "VK404", name: "VK404", floor: 4 },
    ],
  },
];

async function main() {
  for (const b of BUILDINGS) {
    const building = await prisma.building.upsert({
      where: { code: b.code },
      update: { name: b.name },
      create: { code: b.code, name: b.name },
    });

    for (const r of b.rooms) {
      await prisma.room.upsert({
        where: { buildingId_code: { buildingId: building.id, code: r.code } },
        update: { name: r.name, floor: r.floor },
        create: { buildingId: building.id, code: r.code, name: r.name, floor: r.floor },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
