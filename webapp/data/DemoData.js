sap.ui.define(["sapselfservice/domain/Calendar"], function (Calendar) {
    "use strict";

    return function (now = new Date()) {
        const day = (offset) => Calendar.shift(now, offset);
        const employees = [
            ["E100", "anna", "employee", "Anna", "Keller", "IT", "Softwareentwicklerin", 1],
            ["E101", "jonas", "employee", "Jonas", "Weber", "IT", "IT-Support", 0.5],
            ["E200", "leitung", "manager", "Lena", "Hoffmann", "IT", "IT-Leitung", 1],
            ["E201", "hr", "hr", "Miriam", "Vogt", "HR", "Personalreferentin", 1],
            ["E300", "admin", "admin", "Daniel", "Koch", "HR", "Systemadministration", 1],
            ["E400", "ceo", "ceo", "Sophie", "Wagner", "GL", "Geschäftsführung", 1]
        ].map(([id, username, role, firstName, lastName, departmentId, position, factor], index) => ({
            id, username, role, firstName, lastName, departmentId, position, factor,
            email: username + "@personalportal.example",
            profile: {
                Straße: "Musterweg", Hausnummer: String(10 + index), Ort: "Berlin",
                Postleitzahl: "10115", Geschlecht: [1, 4].includes(index) ? "männlich" : "weiblich",
                Geburtsdatum: "15.06.1990", Geburtsort: "Berlin", Geburtsland: "Deutschland",
                Nationalität: "Deutsch", IBAN: "DE00123456780000000000", BIC: "TESTDEBB"
            }
        }));

        return {
            employees,
            departments: [
                { id: "IT", name: "IT & Digitalisierung", managerId: "E200" },
                { id: "HR", name: "Personal", managerId: "E201" },
                { id: "GL", name: "Geschäftsführung", managerId: "E400" }
            ],
            demoPassword: "Demo2026!",
            families: { E100: [{ id: "f1", Name: "Mia Keller", Beziehung: "Tochter", Geburtsdatum: day(-3700) }] },
            emergencyContacts: { E100: { Name: "Alex Keller", Telefonnummer: "+49 30 000000" } },
            absenceTypes: [
                { id: "vacation", name: "Urlaub", range: true },
                { id: "remote", name: "Teleworking", range: false },
                { id: "remote-weekend", name: "Teleworking Wochenende", range: false }
            ],
            absences: [
                { id: "r1", employeeId: "E100", typeId: "vacation", from: day(-35), to: day(-31),
                    requestedOn: day(-50), status: "Genehmigt", vacationDays: 5 },
                { id: "r2", employeeId: "E100", typeId: "remote", from: day(-7), to: day(-7),
                    requestedOn: day(-11), status: "Abgelehnt", start: "08:30", end: "16:30" },
                { id: "r3", employeeId: "E100", typeId: "vacation", from: day(15), to: day(19),
                    requestedOn: day(-2), status: "In Bearbeitung", vacationDays: 3, note: "Familienurlaub" },
                { id: "r4", employeeId: "E200", typeId: "vacation", from: day(50), to: day(55),
                    requestedOn: day(-1), status: "In Bearbeitung", vacationDays: 4 },
                { id: "r5", employeeId: "E201", typeId: "vacation", from: day(-2), to: day(2),
                    requestedOn: day(-20), status: "Genehmigt", vacationDays: 3 },
                { id: "r6", employeeId: "E300", typeId: "remote", from: day(5), to: day(5),
                    requestedOn: day(-1), status: "In Bearbeitung", start: "09:00", end: "17:00" }
            ],
            timeEntries: [{ employeeId: "E100", date: Calendar.key(new Date(now.getFullYear(), now.getMonth(), 1)),
                session1Start: "08:00", session1End: "12:00", session2Start: "12:30", session2End: "16:30",
                hours: 8, pause: 0.5 }],
            documents: [
                ...[9, 10, 11, 12].map((month) => ({ kind: "pay", month, year: 2024, name: "Entgeltnachweis" })),
                ...[2021, 2022, 2023, 2024].map((year) => ({ kind: "tax", year, name: "Lohnsteuerbescheinigung" }))
            ]
        };
    };
});
