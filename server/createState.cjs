const load = require("./amd.cjs");
const seeds = require("./training/catalog.cjs");
const Rules = require("./training/rules.cjs");

module.exports = function createState(clock) {
    const now = clock();
    const { employees, departments, demoPassword } = load("data/DemoData")(now);
    const courses = seeds.map((seed) => ({
        id: seed.id, active: true, revision: 1, draft: null,
        versions: [{ ...Rules.document(seed, true), version: 1, publishedAt: now.toISOString(), publisher: "E300" }],
        audit: [{ action: "Erstveröffentlichung", actor: "E300", at: now.toISOString(), version: 1 }]
    }));
    const today = Rules.Calendar.key(now);
    const old = (offset) => Rules.plusDays(today, offset);
    const assignments = [
        { id: "demo-privacy-anna", courseId: "privacy", employeeId: "E100", dueOn: old(21) },
        { id: "demo-security-anna", courseId: "security", employeeId: "E100", dueOn: old(-4) },
        { id: "demo-communication-anna", courseId: "communication", employeeId: "E100", dueOn: old(28) },
        { id: "demo-privacy-jonas", courseId: "privacy", employeeId: "E101", dueOn: old(-10) },
        { id: "demo-security-jonas", courseId: "security", employeeId: "E101", dueOn: old(-394),
            completedOn: old(-354), validUntil: Rules.Calendar.months(old(-354), 12) },
        { id: "demo-security-leitung", courseId: "security", employeeId: "E200", dueOn: old(-435),
            completedOn: old(-390), validUntil: Rules.Calendar.months(old(-390), 12) }
    ].map((row) => ({
        source: "demo", version: 1, assignedOn: old(-440), acknowledged: [],
        startedAt: null, completedOn: null, validUntil: null, closedOn: null, ...row
    }));
    // Seed imported, synthetic examination evidence only for the two completed examples.
    const attempts = assignments.filter((row) => row.completedOn).map((row) => {
        row.acknowledged = courses.find((course) => course.id === row.courseId).versions[0].chapters.map((_, index) => index);
        row.startedAt = row.completedOn + "T08:00:00.000Z";
        return { id: row.id + "-attempt", assignmentId: row.id, employeeId: row.employeeId, courseId: row.courseId,
            version: 1, at: row.completedOn + "T09:00:00.000Z", points: 9, maximum: 10, percent: 90,
            passed: true, number: 1, demo: true };
    });
    return { schema: 1, employees: employees.map((employee) => ({ ...employee, active: true })),
        departments, demoPassword, courses, assignments, attempts, groupRules: [] };
};
