import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create 3 panels (1 per floor)
  const panels = [
    { panelCode: 'PANEL_LANTAI_1', location: 'Lantai 1 - Main', floor: 1 },
    { panelCode: 'PANEL_LANTAI_2', location: 'Lantai 2 - Office', floor: 2 },
    { panelCode: 'PANEL_LANTAI_3', location: 'Lantai 3 - Meeting', floor: 3 },
  ];

  for (const panel of panels) {
    await prisma.panel.upsert({
      where: { panelCode: panel.panelCode },
      update: {},
      create: panel,
    });
    console.log(`Created/Updated panel: ${panel.panelCode}`);
  }

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
