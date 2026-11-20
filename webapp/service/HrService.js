sap.ui.define(["sapselfservice/domain/Calendar", "sapselfservice/domain/Access", "sapselfservice/domain/HrRules"],
    function (Calendar, Access, Rules) {
    "use strict";

    function name(employee) {
        return employee ? employee.firstName + " " + employee.lastName : "";
    }

    class HrService {
        constructor(repository, clock = () => new Date(), makeId = () => crypto.randomUUID()) {
            this.repository = repository;
            this.clock = clock;
            this.makeId = makeId;
        }

        today() {
            return Calendar.key(this.clock());
        }

        syncPeople(people) {
            return this.repository.transact((state) => {
                for (const person of people) {
                    const existing = state.employees.find((row) => row.id === person.id);
                    if (existing) {
                        existing.role = person.role;
                        existing.departmentId = person.departmentId;
                    } else {
                        state.employees.push({ ...person, profile: {} });
                    }
                }
            });
        }

        session(id) {
            return this.repository.read((state) => {
                const user = state.employees.find((employee) => employee.id === id);
                if (!user) return null;
                const department = state.departments.find((row) => row.id === user.departmentId);
                return {
                    id, Vorname: user.firstName, Nachname: user.lastName, name: name(user),
                    position: user.position, department: department?.name || "",
                    role: Access.label[user.role], permissions: Access.permissions(user.role)
                };
            });
        }

        read(id, select) {
            return this.repository.read((state) => select(state, this.employee(state, id)));
        }

        transact(id, change) {
            return this.repository.transact((state) => change(state, this.employee(state, id)));
        }

        employee(state, id) {
            const employee = state.employees.find((item) => item.id === id);
            Access.requireAccess(Boolean(employee));
            return employee;
        }

        profile(id) {
            return this.read(id, (_, user) => ({ ...user.profile, Vorname: user.firstName,
                Nachname: user.lastName, id, position: user.position }));
        }

        saveProfile(id, group, input) {
            return this.transact(id, (_, user) => {
                const { Vorname, Nachname, ...profile } = Rules.profile(input, group);
                if (group === "personal") {
                    user.firstName = Vorname;
                    user.lastName = Nachname;
                }
                Object.assign(user.profile, profile);
            });
        }

        directory(id) {
            return this.read(id, (state) => state.employees.map((user) => ({
                Vorname: user.firstName, Nachname: user.lastName, role: user.position, Email: user.email,
                emergencyContactName: state.emergencyContacts[user.id]?.Name,
                emergencyContactPhone: state.emergencyContacts[user.id]?.Telefonnummer
            })));
        }

        family(id) {
            return this.read(id, (state) => ({
                familyMembers: (state.families[id] || []).map((row) => ({
                    ...row, Geburtsdatum: Calendar.display(row.Geburtsdatum)
                })),
                emergencyContact: state.emergencyContacts[id] || { Name: "", Telefonnummer: "" }
            }));
        }

        saveFamilyMember(id, row) {
            return this.transact(id, (state) => {
                if (!row.Name.trim() || !row.Beziehung || !Calendar.parse(row.Geburtsdatum) || row.Geburtsdatum > this.today()) {
                    throw new Error("Bitte Name, Beziehung und ein gültiges Geburtsdatum eingeben.");
                }
                const rows = state.families[id] ||= [];
                rows.push({ ...row, Name: row.Name.trim(), id: this.makeId() });
            });
        }

        removeFamilyMember(id, memberId) {
            return this.transact(id, (state) => {
                state.families[id] = (state.families[id] || []).filter((row) => row.id !== memberId);
            });
        }

        saveContact(id, contact) {
            return this.transact(id, (state) => {
                const Name = contact.Name.trim();
                const Telefonnummer = contact.Telefonnummer.trim();
                if (!Name || !/^[+\d][\d ()/-]{4,}$/.test(Telefonnummer)) {
                    throw new Error("Bitte Name und Telefonnummer eingeben.");
                }
                state.emergencyContacts[id] = { Name, Telefonnummer };
            });
        }

        absenceForm(id, date = this.today()) {
            return this.read(id, (state, user) => {
                Access.requireAccess(Access.permissions(user.role).selfService);
                return {
                    Abwesenheitsart: state.absenceTypes.map((row) => ({ "Abwesenheit-ID": row.id, Beschreibung: row.name })),
                    quota: Rules.quota(state, user, date.slice(0, 4), true),
                    approver: name(Rules.approver(state, user, this.today()))
                };
            });
        }

        absenceRows(id, scope = "own") {
            return this.read(id, (state, user) => {
                const permissions = Access.permissions(user.role);
                Access.requireAccess(scope === "team" ? permissions.approveAbsences : permissions.selfService);
                const ids = scope === "team" ? Access.organizationScope(state, user, this.today(), true) : [id];
                return state.absences.filter((row) => ids.includes(row.employeeId) && (
                    scope === "team" ? row.status === "In Bearbeitung" :
                    scope === "decided" ? row.status !== "In Bearbeitung" : true
                )).sort((a, b) => b.requestedOn.localeCompare(a.requestedOn)).map((row) => ({
                    docId: row.id, Antragsdatum: Calendar.display(row.requestedOn), Status: row.status,
                    AbwesenheitsartBeschreibung: state.absenceTypes.find((type) => type.id === row.typeId)?.name || "",
                    DisplayName: name(state.employees.find((employee) => employee.id === row.employeeId)),
                    FormattedStart: Calendar.display(row.from), FormattedEnd: Calendar.display(row.to),
                    Startzeit: row.start, Endzeit: row.end, Kommentare: row.note,
                    state: { Genehmigt: "Success", Abgelehnt: "Error" }[row.status] || "Information"
                }));
            });
        }

        requestAbsence(id, input) {
            return this.transact(id, (state, user) => {
                Access.requireAccess(Access.permissions(user.role).selfService);
                state.absences.push({ ...Rules.absence(state, user, input, this.today()), id: this.makeId() });
            });
        }

        decideAbsence(id, requestId, approve) {
            return this.transact(id, (state, user) => {
                const request = state.absences.find((row) => row.id === requestId);
                Access.requireAccess(request && Access.permissions(user.role).approveAbsences &&
                    Access.organizationScope(state, user, this.today(), true).includes(request.employeeId));
                if (request.status !== "In Bearbeitung") throw new Error("Der Antrag wurde bereits entschieden.");
                request.status = approve ? "Genehmigt" : "Abgelehnt";
            });
        }

        timeEntries(id, month) {
            return this.read(id, (state, user) => {
                Access.requireAccess(Access.permissions(user.role).selfService);
                if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Bitte Monat und Jahr auswählen.");
                return state.timeEntries.filter((row) => row.employeeId === id && row.date.startsWith(month))
                    .sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
                        Datum: Calendar.display(row.date), Arbeitsbeginn: row.session1Start,
                        Arbeitsend: row.session2End || row.session1End, Pausendauer: row.pause.toFixed(2),
                        Stundengesamt: row.hours.toFixed(2)
                    }));
            });
        }

        saveTimeEntries(id, entries) {
            return this.transact(id, (state, user) => {
                Access.requireAccess(Access.permissions(user.role).selfService);
                if (!entries.length) throw new Error("Bitte mindestens einen Eintrag hinzufügen.");
                const days = new Set();
                const records = entries.map(({ date, session1Start, session1End, session2Start, session2End }) => {
                    if (!Calendar.parse(date) || days.has(date)) throw new Error("Bitte pro Tag genau einen gültigen Eintrag erfassen.");
                    days.add(date);
                    const row = { date, session1Start, session1End, session2Start, session2End };
                    return { ...row, ...Rules.duration(row), employeeId: id };
                });
                state.timeEntries = state.timeEntries.filter((row) => row.employeeId !== id || !days.has(row.date));
                state.timeEntries.push(...records);
            });
        }

        documents(id, kind) {
            return this.read(id, (state) => state.documents.filter((row) => row.kind === kind).map((row) => {
                const suffix = row.month ? "-" + String(row.month).padStart(2, "0") : "";
                return { ...row, date: suffix ? suffix.slice(1) + "." + row.year : String(row.year),
                    filePath: "documents/" + kind + "-" + row.year + suffix + ".pdf" };
            }).reverse());
        }
    }

    return HrService;
});
