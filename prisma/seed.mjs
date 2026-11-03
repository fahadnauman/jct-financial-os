import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Production Branches Configuration
const PRODUCTION_BRANCHES = [
  "JCT_HQ",
  "HEMPEL_JUBAIL",
  "JOTUN_DAMMAM",
  "SIGMA_JUBAIL",
];

async function main() {
  console.log("Initializing clean production environment for JCT Financial OS...");
  console.log("Configured Branches:", PRODUCTION_BRANCHES.join(", "));

  // 1. Seed Owner Accounts & Branch Staff Accounts ONLY
  const productionAccounts = [
    {
      name: "BONGSI (Nazim & Nadeem)",
      branch: "JCT_HQ",
      role: "OWNER",
      baseSalary: 0,
      phone: "+966-50-000-0001",
      status: "ACTIVE",
    },
    {
      name: "JCT Main HQ Staff",
      branch: "JCT_HQ",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0002",
      status: "ACTIVE",
    },
    {
      name: "Hempel Jubail Staff",
      branch: "HEMPEL_JUBAIL",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0003",
      status: "ACTIVE",
    },
    {
      name: "Jotun Dammam Staff",
      branch: "JOTUN_DAMMAM",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0004",
      status: "ACTIVE",
    },
    {
      name: "Sigma Paints Staff",
      branch: "SIGMA_JUBAIL",
      role: "STAFF",
      baseSalary: 0,
      phone: "+966-50-000-0005",
      status: "ACTIVE",
    },
  ];

  for (const acc of productionAccounts) {
    const existing = await prisma.staff.findFirst({
      where: { name: acc.name, branch: acc.branch },
    });
    if (!existing) {
      await prisma.staff.create({ data: acc });
    }
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
