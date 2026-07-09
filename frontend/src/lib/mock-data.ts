// LearnSmart AI — comprehensive mock data for all dashboards

export const DEPARTMENTS = ["CDD", "Sales", "Marketing", "Customer Service", "IT", "Finance", "Operations", "Academic"];

export const CATEGORIES = ["Leadership", "Data & Analytics", "Project Management", "Compliance", "AI & Technology", "Communication", "Finance", "Customer Service"];

// ── Users ────────────────────────────────────────────────────────────────────

export const mockTeamMembers = [
  { id: "u1", fullName: "John Smith", email: "john.smith@imet.lk", department: "IT", avatarUrl: null, status: "active", cpdProgress: 85, coursesCompleted: 8 },
  { id: "u2", fullName: "Priya Fernando", email: "priya.f@imet.lk", department: "IT", avatarUrl: null, status: "active", cpdProgress: 72, coursesCompleted: 6 },
  { id: "u3", fullName: "David Brown", email: "david.b@imet.lk", department: "IT", avatarUrl: null, status: "at_risk", cpdProgress: 30, coursesCompleted: 2 },
  { id: "u4", fullName: "Lisa Martinez", email: "lisa.m@imet.lk", department: "IT", avatarUrl: null, status: "at_risk", cpdProgress: 45, coursesCompleted: 3 },
  { id: "u5", fullName: "James Taylor", email: "james.t@imet.lk", department: "IT", avatarUrl: null, status: "inactive", cpdProgress: 60, coursesCompleted: 5 },
  { id: "u6", fullName: "Olivia Wilson", email: "olivia.w@imet.lk", department: "IT", avatarUrl: null, status: "attention", cpdProgress: 55, coursesCompleted: 4 },
];

export const allEmployees = [
  { id: "e1", fullName: "Emma Watson", role: "employee", department: "CDD", status: "active", cpdProgress: 60, lastActive: "Today" },
  { id: "e2", fullName: "John Smith", role: "employee", department: "IT", status: "active", cpdProgress: 85, lastActive: "Today" },
  { id: "e3", fullName: "Priya Fernando", role: "employee", department: "Sales", status: "active", cpdProgress: 72, lastActive: "Yesterday" },
  { id: "e4", fullName: "David Brown", role: "employee", department: "Marketing", status: "at_risk", cpdProgress: 30, lastActive: "3 days ago" },
  { id: "e5", fullName: "Lisa Martinez", role: "employee", department: "Customer Service", status: "at_risk", cpdProgress: 45, lastActive: "2 days ago" },
  { id: "e6", fullName: "James Taylor", role: "employee", department: "Finance", status: "inactive", cpdProgress: 60, lastActive: "7 days ago" },
  { id: "e7", fullName: "Olivia Wilson", role: "employee", department: "CDD", status: "attention", cpdProgress: 55, lastActive: "Yesterday" },
  { id: "e8", fullName: "Michael Brown", role: "employee", department: "IT", status: "active", cpdProgress: 90, lastActive: "Today" },
  { id: "e9", fullName: "Sarah Lee", role: "employee", department: "Sales", status: "active", cpdProgress: 78, lastActive: "Today" },
];

// ── Courses ──────────────────────────────────────────────────────────────────

export const mockCourses = [
  { id: "c1", title: "Data Analysis Fundamentals", source: "Coursera", category: "Data & Analytics", level: "Beginner", progress: 60, status: "in_progress", cpd_hours: 8, rating: 4.7, externalUrl: "https://coursera.org" },
  { id: "c2", title: "Excel for Data Analysis", source: "LinkedIn", category: "Data & Analytics", level: "Beginner", progress: 30, status: "in_progress", cpd_hours: 5, rating: 4.5, externalUrl: "https://linkedin.com/learning" },
  { id: "c3", title: "Leadership Fundamentals", source: "edX", category: "Leadership", level: "Intermediate", progress: 100, status: "completed", cpd_hours: 10, rating: 4.8, externalUrl: "https://edx.org" },
  { id: "c4", title: "Project Management Essentials", source: "Coursera", category: "Project Management", level: "Intermediate", progress: 0, status: "not_started", cpd_hours: 12, rating: 4.6, externalUrl: "https://coursera.org" },
  { id: "c5", title: "Introduction to SQL", source: "Coursera", category: "Data & Analytics", level: "Beginner", progress: 0, status: "not_started", cpd_hours: 6, rating: 4.8, externalUrl: "https://coursera.org" },
  { id: "c6", title: "AI Literacy for Business", source: "edX", category: "AI & Technology", level: "Beginner", progress: 0, status: "not_started", cpd_hours: 8, rating: 4.9, externalUrl: "https://edx.org" },
  { id: "c7", title: "Compliance & Ethics in Finance", source: "Internal", category: "Compliance", level: "Intermediate", progress: 0, status: "not_started", cpd_hours: 6, rating: 4.4, externalUrl: "#" },
  { id: "c8", title: "Customer Service Excellence", source: "LinkedIn", category: "Customer Service", level: "Beginner", progress: 45, status: "in_progress", cpd_hours: 5, rating: 4.6, externalUrl: "https://linkedin.com/learning" },
  { id: "c9", title: "Machine Learning Essentials", source: "Coursera", category: "AI & Technology", level: "Advanced", progress: 0, status: "not_started", cpd_hours: 15, rating: 4.8, externalUrl: "https://coursera.org" },
  { id: "c10", title: "Strategic Communication", source: "edX", category: "Communication", level: "Intermediate", progress: 0, status: "not_started", cpd_hours: 7, rating: 4.5, externalUrl: "https://edx.org" },
];

export const authorCourses = [
  { id: "ac1", title: "Data Analysis Basics", source: "Internal", category: "Data & Analytics", status: "published", enrollments: 45, missing: null },
  { id: "ac2", title: "Leadership for Managers", source: "Coursera", category: "Leadership", status: "published", enrollments: 32, missing: null },
  { id: "ac3", title: "Excel Advanced Techniques", source: "LinkedIn", category: "Data & Analytics", status: "draft", enrollments: 0, missing: "curriculum" },
  { id: "ac4", title: "Project Management Pro", source: "edX", category: "Project Management", status: "draft", enrollments: 0, missing: "learning_outcomes" },
  { id: "ac5", title: "Compliance Essentials", source: "Internal", category: "Compliance", status: "draft", enrollments: 0, missing: "category" },
  { id: "ac6", title: "Customer Handling Skills", source: "Internal", category: "Customer Service", status: "published", enrollments: 28, missing: null },
  { id: "ac7", title: "AI Tools for Business", source: "Coursera", category: "AI & Technology", status: "draft", enrollments: 0, missing: "skill_tags" },
];

// ── Chart data ────────────────────────────────────────────────────────────────

export const teamLearningData = [
  { date: "May 26", progress: 22 },
  { date: "May 27", progress: 28 },
  { date: "May 28", progress: 32 },
  { date: "May 29", progress: 38 },
  { date: "May 30", progress: 45 },
  { date: "May 31", progress: 52 },
  { date: "Jun 1", progress: 68 },
  { date: "Jun 2", progress: 78 },
];

export const learningActivityData = [
  { month: "Jan", completions: 320 },
  { month: "Feb", completions: 480 },
  { month: "Mar", completions: 750 },
  { month: "Apr", completions: 920 },
  { month: "May", completions: 1100 },
  { month: "Jun", completions: 1380 },
];

export const contentActivityData = [
  { month: "Jan", added: 4, published: 3 },
  { month: "Feb", added: 6, published: 5 },
  { month: "Mar", added: 8, published: 6 },
  { month: "Apr", added: 5, published: 7 },
  { month: "May", added: 9, published: 8 },
  { month: "Jun", added: 7, published: 6 },
];

export const myLearningOverTime = [
  { month: "Jan", hours: 4 },
  { month: "Feb", hours: 6 },
  { month: "Mar", hours: 5 },
  { month: "Apr", hours: 8 },
  { month: "May", hours: 7 },
  { month: "Jun", hours: 9 },
];

// ── Department performance ────────────────────────────────────────────────────

export const departmentPerformance = [
  { name: "CDD", value: 88 },
  { name: "Sales", value: 72 },
  { name: "Marketing", value: 78 },
  { name: "Customer Service", value: 68 },
  { name: "IT", value: 85 },
  { name: "Finance", value: 65 },
  { name: "Operations", value: 75 },
  { name: "Academic", value: 80 },
];

// ── Skills ────────────────────────────────────────────────────────────────────

export const skillsGap = [
  { name: "Leadership", count: 12 },
  { name: "AI Literacy", count: 10 },
  { name: "Data Analysis", count: 9 },
  { name: "Project Management", count: 8 },
  { name: "Communication", count: 7 },
];

export const mySkills = [
  { id: "s1", name: "Data Analysis", category: "Data & Analytics", currentLevel: 3, targetLevel: 5 },
  { id: "s2", name: "Python", category: "AI & Technology", currentLevel: 2, targetLevel: 4 },
  { id: "s3", name: "Excel", category: "Data & Analytics", currentLevel: 4, targetLevel: 5 },
  { id: "s4", name: "Communication", category: "Communication", currentLevel: 4, targetLevel: 5 },
  { id: "s5", name: "Project Management", category: "Project Management", currentLevel: 2, targetLevel: 4 },
  { id: "s6", name: "Leadership", category: "Leadership", currentLevel: 1, targetLevel: 3 },
];

export const skillCoverage = [
  { name: "Data Analytics", covered: 70, total: 100 },
  { name: "Leadership", covered: 45, total: 100 },
  { name: "AI & Technology", covered: 30, total: 100 },
  { name: "Compliance", covered: 60, total: 100 },
  { name: "Communication", covered: 55, total: 100 },
];

// ── CPD & Compliance ──────────────────────────────────────────────────────────

export const cpdComplianceData = [
  { name: "On Track", value: 972, color: "#2e7d5b" },
  { name: "At Risk", value: 198, color: "#f59e0b" },
];

export const coursesBySource = [
  { name: "Coursera", value: 42, color: "#2e7d5b" },
  { name: "edX", value: 28, color: "#378add" },
  { name: "LinkedIn", value: 18, color: "#7f77dd" },
  { name: "Internal", value: 12, color: "#9ca3af" },
];

export const learningByCategory = [
  { name: "Leadership", value: 12, color: "#2e7d5b" },
  { name: "Data & Analytics", value: 8, color: "#378add" },
  { name: "Project Management", value: 7, color: "#7f77dd" },
  { name: "Compliance", value: 5, color: "#f59e0b" },
];

export const myCpdRecords = [
  { id: "r1", date: "2024-06-01", hours: 5, source: "course", title: "Data Analysis Fundamentals" },
  { id: "r2", date: "2024-05-20", hours: 3, source: "certificate", title: "Excel Certification" },
  { id: "r3", date: "2024-05-10", hours: 8, source: "course", title: "Leadership Fundamentals" },
  { id: "r4", date: "2024-04-22", hours: 4, source: "manual", title: "Internal Workshop" },
  { id: "r5", date: "2024-04-05", hours: 4, source: "course", title: "Project Management Basics" },
];

export const myCertificates = [
  { id: "cert1", title: "Data Analysis Fundamentals", issuer: "Coursera", cpdHours: 8, issuedDate: "May 2024" },
  { id: "cert2", title: "Excel Advanced", issuer: "Microsoft", cpdHours: 5, issuedDate: "March 2024" },
  { id: "cert3", title: "Leadership Essentials", issuer: "edX", cpdHours: 10, issuedDate: "January 2024" },
];

// ── Recommendations ───────────────────────────────────────────────────────────

export const myRecommendations = [
  { id: "rec1", title: "Introduction to SQL", source: "Coursera", category: "Data & Analytics", matchLabel: "high", matchScore: 92, reason: "Matches your Data Analysis skill gap and current role requirements.", cpd_hours: 6, rating: 4.8, externalUrl: "https://coursera.org" },
  { id: "rec2", title: "Machine Learning Essentials", source: "Coursera", category: "AI & Technology", matchLabel: "high", matchScore: 88, reason: "Aligns with your team's AI Literacy gap and company growth goals.", cpd_hours: 15, rating: 4.8, externalUrl: "https://coursera.org" },
  { id: "rec3", title: "Strategic Communication", source: "edX", category: "Communication", matchLabel: "good", matchScore: 75, reason: "Recommended based on your manager's evaluation feedback.", cpd_hours: 7, rating: 4.5, externalUrl: "https://edx.org" },
  { id: "rec4", title: "Project Management Pro", source: "edX", category: "Project Management", matchLabel: "good", matchScore: 70, reason: "Supports your target skill level of 4 in Project Management.", cpd_hours: 12, rating: 4.6, externalUrl: "https://edx.org" },
];

export const topRecommendedCourses = [
  { title: "Introduction to SQL", matchLabel: "high", count: 18 },
  { title: "Machine Learning Essentials", matchLabel: "high", count: 15 },
  { title: "Leadership Pro", matchLabel: "good", count: 12 },
  { title: "Strategic Communication", matchLabel: "good", count: 9 },
];

// ── Activity feeds ────────────────────────────────────────────────────────────

export const recentTeamActivities = [
  { id: "a1", type: "course_complete", user: "Emily Clark", action: 'completed "Data Analysis Basics"', time: "2 hours ago" },
  { id: "a2", type: "cpd", user: "Michael Lee", action: "logged 3.5 CPD hours", time: "4 hours ago" },
  { id: "a3", type: "course_start", user: "Sarah Wilson", action: 'started "Project Management Essentials"', time: "1 day ago" },
  { id: "a4", type: "course_complete", user: "John Doe", action: 'completed "Leadership Fundamentals"', time: "1 day ago" },
];

export const recentAdminActivities = [
  { id: "aa1", user: "John Smith", action: "Completed course: Data Analytics Essentials", time: "Today, 10:30 AM" },
  { id: "aa2", user: "Sarah Lee", action: "Earned certificate in Project Management", time: "Today, 09:15 AM" },
  { id: "aa3", user: "Michael Brown", action: "Enrolled in learning path: Leadership Excellence", time: "Yesterday, 04:45 PM" },
  { id: "aa4", user: "Emma Watson", action: "Completed CPD target for 2024", time: "Yesterday, 11:20 AM" },
];

export const recentAuthorActivities = [
  { id: "au1", user: "You", action: 'Published "Data Analysis Basics"', time: "2 hours ago" },
  { id: "au2", user: "System", action: '"Excel Advanced Techniques" flagged: missing curriculum', time: "5 hours ago" },
  { id: "au3", user: "You", action: 'Imported "Leadership for Managers" from Coursera', time: "Yesterday" },
  { id: "au4", user: "System", action: '"Data Analysis Basics" now recommended to 18 employees', time: "Yesterday" },
];

export const myRecentActivities = [
  { id: "ma1", type: "course", action: 'Continued "Data Analysis Fundamentals"', time: "Today" },
  { id: "ma2", type: "cpd", action: "Logged 3 CPD hours", time: "Yesterday" },
  { id: "ma3", type: "skill", action: "Updated skill: Data Analysis → Level 3", time: "2 days ago" },
  { id: "ma4", type: "course", action: 'Completed "Leadership Fundamentals"', time: "Last week" },
];

// ── AI insights ───────────────────────────────────────────────────────────────

export const aiInsights = [
  { id: "i1", type: "warning", text: "12 employees are below their CPD target.", highlight: "12 employees" },
  { id: "i2", type: "trend", text: "Leadership skill demand has increased by 18%.", highlight: "18%" },
  { id: "i3", type: "suggestion", text: "AI recommends launching the Data Analytics Learning Path.", highlight: "Data Analytics Learning Path" },
  { id: "i4", type: "achievement", text: "8 new certificates earned this month.", highlight: "8 new certificates" },
];

export const teamAiInsights = [
  { id: "ti1", type: "warning", text: "3 team members haven't logged any activity this week." },
  { id: "ti2", type: "trend", text: "Team CPD completion is 6% higher than last month." },
  { id: "ti3", type: "suggestion", text: "Recommend 'Leadership Pro' to David Brown based on skill gap." },
  { id: "ti4", type: "achievement", text: "Emily Clark completed her learning path this week." },
];

// ── Learning path ─────────────────────────────────────────────────────────────

export const myLearningPath = {
  name: "Data Analytics Track",
  status: "in_progress",
  progress: 40,
  courses: [
    { title: "Data Analysis Fundamentals", status: "in_progress" },
    { title: "Introduction to SQL", status: "not_started" },
    { title: "Machine Learning Essentials", status: "not_started" },
  ],
};
