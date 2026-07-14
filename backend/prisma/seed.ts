/**
 * LearnSmart AI — Prisma seed
 * Run: npx prisma db seed
 *
 * Courses are NOT seeded — the catalogue is populated from real imports
 * (e.g. the Coursera sync). This seed only lays down reference data
 * (departments, categories, the skill taxonomy), the demo staff accounts,
 * and the "AI Agent Developer" role profile used by Nandika's recommendation
 * scenario.
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding LearnSmart AI database…");

  const depts = await Promise.all(
    ["CDD", "Sales", "Marketing", "Customer Service", "IT", "Finance", "Operations", "Academic"].map((name) =>
      prisma.department.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const deptMap = Object.fromEntries(depts.map((d) => [d.name, d]));
  console.log("  ✓ Departments");

  const cats = await Promise.all(
    ["Leadership", "Data & Analytics", "Project Management", "Compliance", "AI & Technology", "Communication", "Finance", "Customer Service"].map((name) =>
      prisma.category.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const catMap = Object.fromEntries(cats.map((c) => [c.name, c]));
  console.log("  ✓ Categories");

  // Base skill taxonomy (master data). Real employee/role skills are added on
  // top of this by document extraction and the role-profile seed below.
  const skillDefs = [
    { name: "Data Analysis", category: "Data & Analytics" },
    { name: "Python", category: "AI & Technology" },
    { name: "Excel", category: "Data & Analytics" },
    { name: "SQL", category: "Data & Analytics" },
    { name: "Machine Learning", category: "AI & Technology" },
    { name: "Leadership", category: "Leadership" },
    { name: "Communication", category: "Communication" },
    { name: "Project Management", category: "Project Management" },
    { name: "Compliance", category: "Compliance" },
    { name: "Customer Service", category: "Customer Service" },
    { name: "Financial Reporting", category: "Finance" },
    { name: "Strategic Planning", category: "Leadership" },
  ];
  await Promise.all(
    skillDefs.map((s) =>
      prisma.skill.upsert({
        where: { name: s.name },
        update: {},
        create: { name: s.name, categoryId: catMap[s.category].id },
      })
    )
  );
  console.log("  ✓ Skills");

  const tempPw = await hash("ImWelcome2026!", 12);
  const adminDemoPw = await hash("ImA7xK92pQr", 12);
  const managerDemoPw = await hash("ImM4vN38tYs", 12);
  const authorDemoPw = await hash("ImT6bL74qXe", 12);
  const employeeDemoPw = await hash("ImE9cR51wZu", 12);

  await prisma.user.upsert({
    where: { email: "admin@imperiallearning.co.uk" },
    update: {},
    create: {
      email: "admin@imperiallearning.co.uk",
      fullName: "Admin User",
      role: "admin",
      status: "active",
      passwordHash: adminDemoPw,
      departmentId: deptMap["IT"].id,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@imperiallearning.co.uk" },
    update: {},
    create: {
      email: "manager@imperiallearning.co.uk",
      fullName: "Sarah Johnson",
      role: "manager",
      status: "active",
      passwordHash: managerDemoPw,
      departmentId: deptMap["IT"].id,
    },
  });

  await prisma.user.upsert({
    where: { email: "author@imperiallearning.co.uk" },
    update: {},
    create: {
      email: "author@imperiallearning.co.uk",
      fullName: "Chris Author",
      role: "author",
      status: "active",
      passwordHash: authorDemoPw,
      departmentId: deptMap["CDD"].id,
    },
  });

  const deptNames = ["CDD", "Sales", "Marketing", "Customer Service", "IT", "Finance", "Operations", "Academic"];

  const namedEmployeeDefs: { name: string; email: string; dept: string }[] = [];

  const extraFirstNames = [
    "Kasun", "Nimali", "Tharindu", "Sanduni", "Chamath", "Hasini", "Ruwan", "Malith",
    "Dinithi", "Vihanga", "Sachini", "Kavindu", "Piumi", "Dilan", "Ishara", "Yasas",
    "Chathuni", "Nadeesha", "Lahiru", "Amaya", "Isuru", "Thilini", "Sahan", "Anjali",
    "Rukshan", "Menaka", "Chanaka", "Iresha", "Buddhika", "Sewwandi", "Dulan", "Anusha",
  ];
  const extraLastNames = [
    "Perera", "Silva", "Jayasuriya", "Rathnayake", "Wickramasinghe", "Gunawardena",
    "Mendis", "Fonseka", "Karunaratne", "Bandara", "Dissanayake", "Herath",
    "Wijesinghe", "Senanayake", "Amarasinghe", "Gunasekara", "Abeywardena",
    "Kodithuwakku", "Weerasinghe", "Jayawardena",
  ];
  const N_EXTRA = 0;
  const generatedEmployeeDefs = Array.from({ length: N_EXTRA }, (_, i) => {
    const fn = extraFirstNames[i % extraFirstNames.length];
    const ln = extraLastNames[Math.floor(i / extraFirstNames.length) % extraLastNames.length];
    return {
      name: `${fn} ${ln}`,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}${i}@imperiallearning.co.uk`,
      dept: deptNames[i % deptNames.length],
    };
  });

  const employeeDefs = [...namedEmployeeDefs, ...generatedEmployeeDefs];
  await Promise.all(
    employeeDefs.map((e) =>
      prisma.user.upsert({
        where: { email: e.email },
        update: {},
        create: {
          email: e.email,
          fullName: e.name,
          role: "employee",
          status: "invited",
          passwordHash: tempPw,
          departmentId: deptMap[e.dept].id,
          managedBy: e.dept === "IT" ? manager.id : undefined,
        },
      })
    )
  );
  const emma = await prisma.user.upsert({
    where: { email: "employee@imperiallearning.co.uk" },
    update: {},
    create: {
      email: "employee@imperiallearning.co.uk",
      fullName: "Emma Stone",
      role: "employee",
      status: "active",
      passwordHash: employeeDemoPw,
      departmentId: deptMap["CDD"].id,
      managedBy: manager.id,
    },
  });
  console.log(`  ✓ Users (admin, manager, author, ${employeeDefs.length} employees)`);

  // ── Recommendation-engine demo: Nandika, AI Agent Developer ─────────────────
  await seedAiAgentDeveloperRole({ deptMap, catMap });

  await Promise.all(
    depts.map((d) =>
      prisma.cpdTarget.upsert({
        where: { departmentId_year: { departmentId: d.id, year: 2024 } },
        update: {},
        create: { departmentId: d.id, hoursPerYear: 40, year: 2024 },
      })
    )
  );
  console.log("  ✓ CPD targets");

  await prisma.orgStatement.upsert({
    where: { year: 2024 },
    update: {},
    create: { content: "iMET is committed to building a data-literate workforce, expanding leadership capabilities across all levels, and embedding AI literacy into every department by 2025.", year: 2024 },
  });
  console.log("  ✓ Org statement");

  console.log("\n✅ Seeding complete.");
  console.log("\nDemo accounts (active immediately):");
  console.log("  admin@imperiallearning.co.uk    → ImA7xK92pQr");
  console.log("  manager@imperiallearning.co.uk (manager) → ImM4vN38tYs");
  console.log("  author@imperiallearning.co.uk  → ImT6bL74qXe");
  console.log("  nandika@imperiallearning.co.uk (employee · AI Agent Developer) → ImWelcome2026! (fresh DB only; live account preserved)");
}

/**
 * Seeds the "AI Agent Developer" role profile and Nandika's recommendation
 * scenario.
 *
 * The role's required skills use the SAME canonical skill names the extractor
 * already stored for Nandika, so gap analysis lines up his real, document-
 * derived current levels against the role's requirements (producing a realistic
 * mix of met requirements and skill gaps to target).
 *
 * Non-destructive on the live DB: Nandika's account and his uploaded skill
 * levels are preserved (`update: {}`); the `create` branches only run on a
 * fresh database so the scenario is reproducible from scratch.
 */
async function seedAiAgentDeveloperRole({
  deptMap,
  catMap,
}: {
  deptMap: Record<string, { id: string }>;
  catMap: Record<string, { id: string }>;
}) {
  const aiCatId = catMap["AI & Technology"].id;
  const ROLE_TITLE = "AI Agent Developer";
  const ROLE_DESCRIPTION =
    "Designs, builds and hardens LLM-powered agents: prompt and context engineering, " +
    "retrieval-augmented generation, multi-agent orchestration, tool/function calling, " +
    "evaluation, and agent security.";

  // Core requirements for the role. `requiredLevel` is on the 0–4 scale
  // (None…Expert). Chosen against Nandika's recorded levels to yield a realistic
  // gap mix (some met, some needing improvement, one critical).
  const roleSkillDefs: {
    name: string;
    requiredLevel: number;
    importance: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    reason: string;
    // Representative current/target used ONLY when seeding a fresh DB.
    seedCurrent: number;
    seedTarget: number;
  }[] = [
    { name: "Prompt Engineering", requiredLevel: 4, importance: "CRITICAL", reason: "Designs reliable prompts and system instructions that steer agent behaviour.", seedCurrent: 3, seedTarget: 4 },
    { name: "Retrieval-Augmented Generation (RAG)", requiredLevel: 3, importance: "CRITICAL", reason: "Grounds agent responses in retrieved, up-to-date context.", seedCurrent: 3, seedTarget: 3 },
    { name: "Multi-Agent System", requiredLevel: 3, importance: "HIGH", reason: "Orchestrates collaborating agents to solve complex tasks.", seedCurrent: 2, seedTarget: 3 },
    { name: "Langchain / Langgraph", requiredLevel: 3, importance: "HIGH", reason: "Builds and wires agent graphs, tools, and memory.", seedCurrent: 3, seedTarget: 3 },
    { name: "Vector Databases", requiredLevel: 3, importance: "HIGH", reason: "Stores and queries embeddings for retrieval and agent memory.", seedCurrent: 3, seedTarget: 3 },
    { name: "Function Calling / Tool", requiredLevel: 3, importance: "HIGH", reason: "Exposes tools and APIs the agent can invoke safely.", seedCurrent: 4, seedTarget: 4 },
    { name: "Python", requiredLevel: 4, importance: "HIGH", reason: "Primary language for agent implementation and integration.", seedCurrent: 4, seedTarget: 4 },
    { name: "Fine-Tuning (LoRA)", requiredLevel: 3, importance: "MEDIUM", reason: "Adapts base models to domain tasks efficiently.", seedCurrent: 1, seedTarget: 3 },
    { name: "Ai Security", requiredLevel: 3, importance: "HIGH", reason: "Guards against prompt injection, data leakage, and unsafe tool use.", seedCurrent: 2, seedTarget: 3 },
    { name: "LLM Evaluation (RAGAS)", requiredLevel: 3, importance: "MEDIUM", reason: "Measures answer quality, faithfulness, and retrieval accuracy.", seedCurrent: 2, seedTarget: 3 },
    { name: "API Integration", requiredLevel: 3, importance: "MEDIUM", reason: "Connects agents to external services and data sources.", seedCurrent: 4, seedTarget: 4 },
  ];

  // Upsert the skills — finds Nandika's existing rows, creates any that are missing.
  const skillByName: Record<string, { id: string }> = {};
  for (const s of roleSkillDefs) {
    skillByName[s.name] = await prisma.skill.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, categoryId: aiCatId },
    });
  }

  // Role profile — keyed by title so it matches User.position "AI Agent Developer".
  const role = await prisma.roleProfile.upsert({
    where: { title: ROLE_TITLE },
    update: { departmentId: deptMap["CDD"].id, description: ROLE_DESCRIPTION },
    create: { title: ROLE_TITLE, description: ROLE_DESCRIPTION, departmentId: deptMap["CDD"].id },
  });

  await Promise.all(
    roleSkillDefs.map((r) =>
      prisma.roleSkillRequirement.upsert({
        where: { roleProfileId_skillId: { roleProfileId: role.id, skillId: skillByName[r.name].id } },
        update: { requiredLevel: r.requiredLevel, importance: r.importance, reason: r.reason },
        create: {
          roleProfileId: role.id,
          skillId: skillByName[r.name].id,
          requiredLevel: r.requiredLevel,
          importance: r.importance,
          reason: r.reason,
        },
      })
    )
  );

  // Nandika — active employee whose position matches the role. Preserves the
  // live account (update only sets position/department; never touches password).
  const nandikaPw = await hash("ImWelcome2026!", 12);
  const nandika = await prisma.user.upsert({
    where: { email: "nandika@imperiallearning.co.uk" },
    update: { position: ROLE_TITLE, departmentId: deptMap["CDD"].id },
    create: {
      email: "nandika@imperiallearning.co.uk",
      fullName: "Nandika Anupama",
      role: "employee",
      status: "active",
      passwordHash: nandikaPw,
      position: ROLE_TITLE,
      departmentId: deptMap["CDD"].id,
    },
  });

  // Current skill levels. On the live DB Nandika's real, document-extracted
  // levels already exist, so `update: {}` preserves them; `create` values only
  // apply on a fresh DB.
  await Promise.all(
    roleSkillDefs.map((s) =>
      prisma.userSkill.upsert({
        where: { userId_skillId: { userId: nandika.id, skillId: skillByName[s.name].id } },
        update: {},
        create: {
          userId: nandika.id,
          skillId: skillByName[s.name].id,
          currentLevel: s.seedCurrent,
          targetLevel: s.seedTarget,
        },
      })
    )
  );

  console.log("  ✓ Role profile (Nandika Anupama · AI Agent Developer)");
  console.log("    nandika@imperiallearning.co.uk");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
