/**
 * LearnSmart AI — Prisma seed
 * Run: npx prisma db seed
 */

import { PrismaClient, CourseSource, CourseStatus, EnrollmentStatus, CpdSource, CertificateStatus } from "@prisma/client";
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
  const skills = await Promise.all(
    skillDefs.map((s) =>
      prisma.skill.upsert({
        where: { name: s.name },
        update: {},
        create: { name: s.name, categoryId: catMap[s.category].id },
      })
    )
  );
  const skillMap = Object.fromEntries(skills.map((s) => [s.name, s]));
  console.log("  ✓ Skills");

  const tempPw = await hash("ImWelcome2026!", 12);
  const adminDemoPw = await hash("ImA7xK92pQr", 12);
  const managerDemoPw = await hash("ImM4vN38tYs", 12);
  const authorDemoPw = await hash("ImT6bL74qXe", 12);

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

  const namedEmployeeDefs = [
    { name: "Emma Watson", email: "employee@imperiallearning.co.uk", dept: "CDD" },
  ];

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
  const employees = await Promise.all(
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
  const emma = employees[0];
  console.log(`  ✓ Users (admin, manager, author, ${employeeDefs.length} employees)`);

  const courseDefs = [
    { title: "Data Analysis Fundamentals", source: CourseSource.coursera, category: "Data & Analytics", level: "Beginner", cpdHours: 8, rating: 4.7, status: CourseStatus.published, url: "https://coursera.org", curriculum: "Introduction to data analysis, Python basics, Pandas, Matplotlib, Case studies", learningOutcomes: "Analyse datasets using Python and Pandas, visualise data with Matplotlib", skills: ["Data Analysis", "Python", "Excel"] },
    { title: "Excel for Data Analysis", source: CourseSource.linkedin, category: "Data & Analytics", level: "Beginner", cpdHours: 5, rating: 4.5, status: CourseStatus.published, url: "https://linkedin.com/learning", curriculum: "Advanced Excel functions, Pivot tables, Power Query, Data visualisation", learningOutcomes: "Use advanced Excel features for data analysis and reporting", skills: ["Excel", "Data Analysis"] },
    { title: "Leadership Fundamentals", source: CourseSource.edx, category: "Leadership", level: "Intermediate", cpdHours: 10, rating: 4.8, status: CourseStatus.published, url: "https://edx.org", curriculum: "Leadership styles, Team motivation, Conflict resolution, Strategic thinking", learningOutcomes: "Lead teams effectively and resolve conflicts constructively", skills: ["Leadership", "Communication"] },
    { title: "Introduction to SQL", source: CourseSource.coursera, category: "Data & Analytics", level: "Beginner", cpdHours: 6, rating: 4.8, status: CourseStatus.published, url: "https://coursera.org", curriculum: "SQL basics, SELECT queries, JOINs, Aggregations, Subqueries", learningOutcomes: "Query relational databases using SQL", skills: ["SQL", "Data Analysis"] },
    { title: "Machine Learning Essentials", source: CourseSource.coursera, category: "AI & Technology", level: "Advanced", cpdHours: 15, rating: 4.8, status: CourseStatus.published, url: "https://coursera.org", curriculum: "Supervised learning, Neural networks, Model evaluation, Deployment", learningOutcomes: "Build and evaluate machine learning models", skills: ["Machine Learning", "Python"] },
    { title: "Project Management Essentials", source: CourseSource.coursera, category: "Project Management", level: "Intermediate", cpdHours: 12, rating: 4.6, status: CourseStatus.published, url: "https://coursera.org", curriculum: "Agile, Scrum, Project planning, Risk management, Stakeholder management", learningOutcomes: "Plan and deliver projects using agile methodologies", skills: ["Project Management"] },
    { title: "Compliance & Ethics in Finance", source: CourseSource.internal, category: "Compliance", level: "Intermediate", cpdHours: 6, rating: 4.4, status: CourseStatus.published, url: null, curriculum: "Regulatory framework, AML/KYC, Ethical decision making, Case studies", learningOutcomes: "Understand compliance obligations and apply ethical frameworks", skills: ["Compliance", "Financial Reporting"] },
    { title: "Customer Service Excellence", source: CourseSource.linkedin, category: "Customer Service", level: "Beginner", cpdHours: 5, rating: 4.6, status: CourseStatus.published, url: "https://linkedin.com/learning", curriculum: "Customer psychology, Communication skills, Handling complaints, CX metrics", learningOutcomes: "Deliver exceptional customer service and resolve complaints effectively", skills: ["Customer Service", "Communication"] },
  ];

  const courses = await Promise.all(
    courseDefs.map((c) =>
      prisma.course.upsert({
        where: { title: c.title },
        update: {},
        create: {
          title: c.title,
          source: c.source,
          externalUrl: c.url,
          level: c.level,
          cpdHours: c.cpdHours,
          rating: c.rating,
          status: c.status,
          curriculum: c.curriculum,
          learningOutcomes: c.learningOutcomes,
          categoryId: catMap[c.category].id,
          courseSkills: {
            create: c.skills.map((sName) => ({ skillId: skillMap[sName].id, weight: 1.0 })),
          },
        },
      })
    )
  );
  console.log("  ✓ Courses");

  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: emma.id, courseId: courses[0].id } },
    update: {},
    create: { userId: emma.id, courseId: courses[0].id, status: EnrollmentStatus.in_progress, progress: 60, startedAt: new Date("2024-04-01") },
  });
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: emma.id, courseId: courses[1].id } },
    update: {},
    create: { userId: emma.id, courseId: courses[1].id, status: EnrollmentStatus.in_progress, progress: 30, startedAt: new Date("2024-05-01") },
  });
  const completedEnroll = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: emma.id, courseId: courses[2].id } },
    update: {},
    create: { userId: emma.id, courseId: courses[2].id, status: EnrollmentStatus.completed, progress: 100, startedAt: new Date("2024-01-01"), completedAt: new Date("2024-02-01") },
  });
  console.log("  ✓ Enrollments");

  const existingCpdCount = await prisma.cpdRecord.count({ where: { userId: emma.id } });
  if (existingCpdCount === 0) {
    await prisma.cpdRecord.create({
      data: { userId: emma.id, hours: 10, source: CpdSource.course, enrollmentId: completedEnroll.id, description: "Leadership Fundamentals" },
    });
    await prisma.cpdRecord.create({
      data: { userId: emma.id, hours: 5, source: CpdSource.manual, description: "Internal workshop — Q1 Strategy Day" },
    });
    await prisma.cpdRecord.create({
      data: { userId: emma.id, hours: 4, source: CpdSource.manual, description: "External Webinar — Data Literacy" },
    });
    console.log("  ✓ CPD records");
  } else {
    console.log("  ↷ CPD records already present, skipped");
  }

  await prisma.certificate.upsert({
    where: { userId_title: { userId: emma.id, title: "Leadership Fundamentals" } },
    update: {},
    create: { userId: emma.id, title: "Leadership Fundamentals", issuer: "edX", cpdHours: 10, issuedDate: "January 2024", status: CertificateStatus.approved },
  });
  await prisma.certificate.upsert({
    where: { userId_title: { userId: emma.id, title: "Excel Advanced" } },
    update: {},
    create: { userId: emma.id, title: "Excel Advanced", issuer: "Microsoft", cpdHours: 5, issuedDate: "March 2024", status: CertificateStatus.approved },
  });
  console.log("  ✓ Certificates");

  const emmaSkills = [
    { skill: "Data Analysis", current: 3, target: 5 },
    { skill: "Python", current: 2, target: 4 },
    { skill: "Excel", current: 4, target: 5 },
    { skill: "Communication", current: 4, target: 5 },
    { skill: "Project Management", current: 2, target: 4 },
    { skill: "Leadership", current: 1, target: 3 },
  ];
  await Promise.all(
    emmaSkills.map((s) =>
      prisma.userSkill.upsert({
        where: { userId_skillId: { userId: emma.id, skillId: skillMap[s.skill].id } },
        update: { currentLevel: s.current, targetLevel: s.target },
        create: { userId: emma.id, skillId: skillMap[s.skill].id, currentLevel: s.current, targetLevel: s.target },
      })
    )
  );
  console.log("  ✓ User skills");

  const recDefs = [
    { courseId: courses[3].id, matchLabel: "high" as const, matchScore: 92, reason: "Matches your Data Analysis skill gap and current role requirements." },
    { courseId: courses[4].id, matchLabel: "high" as const, matchScore: 88, reason: "Aligns with your team's AI Literacy gap and company growth goals." },
    { courseId: courses[5].id, matchLabel: "good" as const, matchScore: 75, reason: "Recommended based on your manager's evaluation feedback." },
  ];
  await Promise.all(
    recDefs.map((r) =>
      prisma.recommendation.upsert({
        where: { userId_courseId: { userId: emma.id, courseId: r.courseId } },
        update: {},
        create: { userId: emma.id, courseId: r.courseId, matchLabel: r.matchLabel, matchScore: r.matchScore, reason: r.reason },
      })
    )
  );
  console.log("  ✓ Recommendations");

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
  console.log("\nDemo accounts (active immediately, populated with data):");
  console.log("  admin@imperiallearning.co.uk    → ImA7xK92pQr");
  console.log("  manager@imperiallearning.co.uk (manager) → ImM4vN38tYs");
  console.log("  author@imperiallearning.co.uk  → ImT6bL74qXe");
  console.log("  employee@imperiallearning.co.uk (employee)  → ImE9cR51wZu");
  console.log(`\nRemaining ${employeeDefs.length - 1} employees: invited, shared temp password:`);
  console.log("  <their own email> → ImWelcome2026!");
  console.log("  Forced to /set-password before reaching any dashboard, then use their own password.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
