sap.ui.define([], function () {
    "use strict";

    const label = {
        employee: "Mitarbeiter", manager: "Führungskraft", hr: "Personalabteilung",
        admin: "Administration", ceo: "Geschäftsführung"
    };

    function permissions(role) {
        return {
            authorTrainings: role === "admin",
            manageTrainings: ["admin", "hr"].includes(role),
            approveAbsences: ["admin", "hr", "manager", "ceo"].includes(role),
            selfService: role !== "ceo",
            teamTraining: ["admin", "hr", "manager", "ceo"].includes(role)
        };
    }

    function requireAccess(allowed) {
        if (!allowed) throw new Error("Für diese Aktion fehlt die Berechtigung.");
    }

    function organizationScope(state, user, today, delegate) {
        const leaders = state.departments.map((department) => department.managerId);
        const owned = state.departments.filter((department) => department.managerId === user.id);
        const delegated = state.departments.filter((department) => delegate && state.absences.some((row) =>
            row.employeeId === department.managerId && row.typeId === "vacation" &&
            row.status === "Genehmigt" && row.from <= today && row.to >= today));
        return state.employees.filter((employee) => employee.id !== user.id && (
            user.role === "admin" || user.role === "hr" ||
            owned.some((department) => employee.departmentId === department.id) ||
            (user.role === "ceo" && (leaders.includes(employee.id) ||
                delegated.some((department) => employee.departmentId === department.id)))
        )).map((employee) => employee.id);
    }

    return { label, permissions, requireAccess, organizationScope };
});
