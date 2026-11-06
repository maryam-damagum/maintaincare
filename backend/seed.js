
require("dotenv").config();

const { PrismaPg } = require("@prisma/adapter-pg");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing from your .env file.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Create maintenance categories.
    const categories = [
      {
        name: "Electrical",
        description: "Lighting, power supply, fans, and electrical faults.",
      },
      {
        name: "Plumbing",
        description: "Leaking taps, pipes, toilets, and water supply.",
      },
      {
        name: "Network",
        description: "Internet connectivity and network equipment.",
      },
      {
        name: "Furniture",
        description: "Desks, chairs, doors, and other furniture.",
      },
      {
        name: "Cleaning",
        description: "Cleaning and sanitation-related issues.",
      },
    ];

    for (const category of categories) {
      await prisma.requestCategory.upsert({
        where: { name: category.name },
        update: { description: category.description },
        create: category,
      });
    }

    console.log("Maintenance categories created.");

    // Development-only test accounts.
    const testPassword = await bcrypt.hash("LocalTest#2026", 12);

    const users = [
      {
        fullName: "Test Student",
        email: "student@example.com",
        role: "STUDENT",
      },
      {
        fullName: "Test Maintenance Officer",
        email: "officer@example.com",
        role: "MAINTENANCE_OFFICER",
      },
      {
        fullName: "Test Administrator",
        email: "admin@example.com",
        role: "ADMIN",
      },
      {
        fullName: "Test Staff",
        email: "staff@example.com",
        role: "STAFF",
      },
    ];

    for (const user of users) {
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          ...user,
          passwordHash: testPassword,
        },
      });
    }

    console.log("Development test accounts created or already exist.");
    console.log("Seed completed successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exitCode = 1;
});
