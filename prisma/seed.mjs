import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Production Branches Configuration
const PRODUCTION_BRANCHES = [
  "JCT_HARDWARE_JOTUN",
  "HEMPEL",
  "DAMMAM_JOTUN",
  "SIGMA",
];

async function main() {
  console.log("Initializing clean production environment for JCT Financial OS...");
  console.log("Configured Branches:", PRODUCTION_BRANCHES.join(", "));

  // Ensure any stale auto-seeded locks or demo transactions are purged
  await prisma.dailyRegisterLock.deleteMany({});
  await prisma.pocketTransaction.deleteMany({});
  await prisma.payrollLog.deleteMany({});
  await prisma.creditRadar.deleteMany({});
  await prisma.creditCustomer.deleteMany({});

  // 1. Seed Owner Accounts & Branch Staff Accounts ONLY
  const productionAccounts = [
    {
      name: "Owner (Nazim & Nadeem)",
      branch: "JCT_HARDWARE_JOTUN",
      role: "OWNER",
      baseSalary: 0,
      phone: "+966-50-000-0001",
      status: "ACTIVE",
    },
    {
      name: "JCT Hardware + Jotun Staff",
      branch: "JCT_HARDWARE_JOTUN",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0002",
      status: "ACTIVE",
    },
    {
      name: "Hempel Staff",
      branch: "HEMPEL",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0003",
      status: "ACTIVE",
    },
    {
      name: "Dammam Jotun Staff",
      branch: "DAMMAM_JOTUN",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0004",
      status: "ACTIVE",
    },
    {
      name: "Sigma Staff",
      branch: "SIGMA",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0005",
      status: "ACTIVE",
    },
  ];

  await prisma.staff.deleteMany({});
  for (const acc of productionAccounts) {
    await prisma.staff.create({ data: acc });
  }

  // Dummy invoices, previous day balances, queued swipes, expenses, and historical daily registers
  // have been removed for clean production deployment.

  console.log("✅ Production Owner accounts, Staff accounts, and Branches seeded cleanly.");
}

main()
  .catch((e) => {
    console.error("Production seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
