const { randomUUID } = require("node:crypto");
const Rules = require("./rules.cjs");
const Access = require("../amd.cjs")("domain/Access");
const { Calendar, check, text, integer, plusDays } = Rules;

const latest = (course) => course.versions.at(-1);
const published = (course, version) => course.versions.find((row) => row.version === version);
const fullName = (person) => person.firstName + " " + person.lastName;
const personDTO = ({ id, username, firstName, lastName, role, position, departmentId, factor, email }) =>
    ({ id, username, firstName, lastName, role, position, departmentId, factor, email });
const assignmentKey = (courseId, employeeId) => courseId + ":" + employeeId;

class TrainingService {
    constructor(repository, clock = () => new Date(), makeId = randomUUID) {
        this.repository = repository;
        this.clock = clock;
        this.makeId = makeId;
    }

    now() { return this.clock().toISOString(); }
    today() { return Calendar.key(this.clock()); }

    employee(state, id) {
        const employee = state.employees.find((row) => row.id === id && row.active);
        check(employee, "Aktives Demokonto erforderlich.", 401);
        return employee;
    }

    authorize(employee, task) {
        const allowed = task === "author" ? employee.role === "admin" : Access.permissions(employee.role).manageTrainings;
        check(allowed, "Für diese Aktion fehlt die Berechtigung.", 403);
    }

    course(state, id) {
        const course = state.courses.find((row) => row.id === id);
        check(course, "Schulung nicht gefunden.", 404);
        return course;
    }

    actor(id, task, action) {
        return this.repository.transact((state) => {
            const employee = this.employee(state, id);
            if (task) this.authorize(employee, task);
            return action(state, employee);
        });
    }

    options() {
        return this.repository.read((state) => ({
            accounts: state.employees.filter((row) => row.active).map((row) => ({
                username: row.username, title: fullName(row), role: Access.label[row.role]
            })),
            passwordHint: "Demo-Anmeldung · Passwort: " + state.demoPassword
        }));
    }

    authenticate(input) {
        return this.repository.read((state) => {
            const username = typeof input.username === "string" ? input.username.trim().toLowerCase() : "";
            const employee = state.employees.find((row) => row.username === username && row.active);
            check(employee && input.password === state.demoPassword, "Benutzername oder Passwort ist ungültig.", 401);
            return employee.id;
        });
    }

    identity(id) {
        return this.repository.read((state) => {
            const employee = this.employee(state, id);
            return {
                id: employee.id,
                people: state.employees.filter((row) => row.active).map(personDTO)
            };
        });
    }

    createEmployee(id, input) {
        return this.actor(id, "author", (state) => {
            const username = text(input.username, "Benutzername", 40).toLowerCase();
            check(/^[a-z][a-z0-9._-]+$/.test(username), "Der Benutzername benötigt mindestens zwei Zeichen und beginnt mit einem Buchstaben.");
            check(!state.employees.some((row) => row.username === username), "Der Benutzername ist bereits vergeben.", 409);
            check(state.departments.some((row) => row.id === input.departmentId), "Bitte eine Abteilung auswählen.");
            const employee = {
                id: this.makeId(), username, firstName: text(input.firstName, "Vorname", 100),
                lastName: text(input.lastName, "Nachname", 100), position: text(input.position, "Funktion", 100),
                departmentId: input.departmentId, factor: 1, email: username + "@personalportal.example",
                role: "employee", active: true
            };
            state.employees.push(employee);
            this.synchronize(state);
            return personDTO(employee);
        });
    }

    newAssignment(course, employeeId, dueOn, source, extras = {}) {
        return {
            id: this.makeId(), courseId: course.id, version: latest(course).version, employeeId,
            assignedOn: this.today(), dueOn, source, acknowledged: [], startedAt: null,
            completedOn: null, validUntil: null, closedOn: null, ...extras
        };
    }

    synchronize(state) {
        const today = this.today();
        const current = new Map(state.assignments.filter((row) => !row.closedOn)
            .map((row) => [assignmentKey(row.courseId, row.employeeId), row]));
        const activePeople = state.employees.filter((person) => person.active);
        const rulesByCourse = new Map();
        for (const rule of state.groupRules) {
            if (!rulesByCourse.has(rule.courseId)) rulesByCourse.set(rule.courseId, []);
            rulesByCourse.get(rule.courseId).push(rule);
        }
        const add = (course, employeeId, dueOn, source, extras) => {
            const row = this.newAssignment(course, employeeId, dueOn, source, extras);
            state.assignments.push(row);
            current.set(assignmentKey(course.id, employeeId), row);
        };

        for (const course of state.courses) {
            const version = latest(course);
            if (!course.active || !version) continue;
            for (const person of activePeople) {
                const rule = rulesByCourse.get(course.id)?.find((item) => item.departmentId === person.departmentId);
                const row = current.get(assignmentKey(course.id, person.id));
                if (!row) {
                    if (version.mandatory && (version.audience === "all" || rule)) {
                        add(course, person.id, plusDays(today, rule?.dueDays ?? version.dueDays),
                            rule ? "group" : "mandatory", rule ? { groupRuleId: rule.id } : {});
                    }
                    continue;
                }
                if (!row.startedAt && !row.completedOn) row.version = version.version;
                const previous = published(course, row.version);
                if (row.validUntil && row.validUntil < today && previous.renewalDays) {
                    row.closedOn = today;
                    row.closeReason = "expired";
                    add(course, person.id, plusDays(plusDays(row.validUntil, 1), previous.renewalDays), row.source, {
                        renewedFrom: row.id, groupRuleId: row.groupRuleId
                    });
                }
            }
        }
    }

    overview(id) {
        return this.actor(id, null, (state, employee) => {
            this.synchronize(state);
            const rights = Access.permissions(employee.role);
            const author = employee.role === "admin";
            const scope = new Set([id, ...(rights.teamTraining ?
                Access.organizationScope(state, employee, this.today(), false) : [])]);
            const people = state.employees.filter((row) => row.active && scope.has(row.id));
            const byPerson = new Map(people.map((row) => [row.id, row]));
            const courses = new Map(state.courses.map((row) => [row.id, row]));
            const attempts = new Map();
            const proofs = new Map();
            for (const attempt of state.attempts) {
                if (scope.has(attempt.employeeId)) attempts.set(attempt.assignmentId, attempt);
            }
            for (const row of state.assignments) {
                const key = assignmentKey(row.courseId, row.employeeId);
                if (row.completedOn && (!proofs.has(key) || proofs.get(key).completedOn < row.completedOn)) proofs.set(key, row);
            }
            const assignments = state.assignments.filter((row) => byPerson.has(row.employeeId)).map((row) =>
                this.assignmentDTO(row, courses.get(row.courseId), byPerson.get(row.employeeId), id, rights, attempts.get(row.id),
                    proofs.get(assignmentKey(row.courseId, row.employeeId))));
            assignments.sort((a, b) => a.dueOn.localeCompare(b.dueOn) || a.title.localeCompare(b.title, "de"));
            const own = assignments.filter((row) => row.own && row.status !== "history");
            const privacy = own.find((row) => latest(courses.get(row.trainingId)).purpose === "privacy");
            return {
                ownId: id, manage: rights.manageTrainings, team: rights.teamTraining, author,
                people: people.map((row) => ({ id: row.id, name: fullName(row) })),
                trainings: state.courses.filter((course) => author || course.versions.length).map((course) => {
                    const version = latest(course) || course.draft;
                    const { title, description, category, mandatory, validityMonths } = version;
                    return { id: course.id, title, description, category, mandatory, validityMonths,
                        active: course.active && !!latest(course), currentVersion: latest(course)?.version ?? 0,
                        hasDraft: Boolean(course.draft) };
                }),
                assignments, privacy: privacy || null,
                reminders: own.filter((row) => row.mandatory && row.active &&
                    (row.renewalRequired || ["dueSoon", "overdue", "expiring", "expired"].includes(row.status)))
                    .map((row) => ({ id: row.id, title: row.title,
                        label: row.renewalRequired ? "Wiederholung · " + row.label : row.label, tone: row.tone,
                        date: ["expired", "expiring"].includes(row.status) ? row.validText : row.dueText })),
                departments: rights.manageTrainings ? state.departments : [],
                groupRules: rights.manageTrainings ? state.groupRules.map((rule) => ({
                    ...rule, title: latest(courses.get(rule.courseId)).title,
                    group: state.departments.find((row) => row.id === rule.departmentId).name,
                    dueText: rule.dueDays + " Tage ab Zuweisung"
                })) : [],
                history: rights.manageTrainings ? state.attempts.filter((row) => byPerson.has(row.employeeId))
                    .map((row) => this.attemptDTO(row, courses, byPerson)).reverse() : []
            };
        });
    }

    attemptDTO(row, courses, people) {
        return { ...row, employee: fullName(people.get(row.employeeId)),
            title: published(courses.get(row.courseId), row.version).title };
    }

    assignmentDTO(row, course, employee, actor, rights, attempt, proof) {
        const version = published(course, row.version);
        const [status, label, tone] = Rules.classify(row, course, this.today());
        const own = actor === employee.id;
        const retryLocked = !row.completedOn && version.maxAttempts > 0 && attempt?.number >= version.maxAttempts;
        const live = !row.closedOn && !row.completedOn && course.active;
        const mandatory = Boolean(latest(course)?.mandatory);
        return {
            id: row.id, trainingId: row.courseId, employeeId: row.employeeId, employee: fullName(employee), own,
            title: version.title, category: version.category, description: version.description, version: row.version,
            mandatory, active: course.active, dueOn: row.dueOn, closedOn: row.closedOn,
            renewalRequired: Boolean(live && row.renewedFrom),
            dueText: Calendar.display(row.dueOn), completedText: Calendar.display(row.completedOn),
            validText: Calendar.display(row.validUntil), status, label: retryLocked && live ? "Versuchslimit erreicht" : label,
            tone: retryLocked && live ? "Error" : tone,
            progress: Math.round(row.acknowledged.length / version.chapters.length * 100),
            progressText: row.acknowledged.length + " von " + version.chapters.length + " Kapiteln",
            lastCompleted: Calendar.display(proof?.completedOn), lastValidUntil: Calendar.display(proof?.validUntil),
            lastScore: attempt ? attempt.percent + " %" : "",
            canLearn: own && (course.active || Boolean(row.completedOn)),
            canRenew: rights.manageTrainings && course.active && (status === "expired" || (live && retryLocked)),
            canEdit: rights.manageTrainings && live,
            canRemove: rights.manageTrainings && live && row.source === "manual" && !row.startedAt
        };
    }

    editor(id, courseId) {
        return this.actor(id, "author", (state) => {
            const course = this.course(state, courseId);
            return {
                id: course.id, draft: course.draft || latest(course), revision: course.revision,
                active: course.active, versions: course.versions.map(({ version, title, publishedAt }) => ({ version, title, publishedAt })),
                audit: course.audit.map((entry) => ({
                    ...entry, name: fullName(state.employees.find((person) => person.id === entry.actor))
                }))
            };
        });
    }

    saveDraft(id, input) {
        return this.actor(id, "author", (state) => {
            const draft = Rules.document(input.draft);
            const course = input.id ? this.course(state, input.id) : {
                id: this.makeId(), active: false, revision: 0, draft: null, versions: [], audit: []
            };
            check(course.revision === input.revision, "Die Schulung wurde zwischenzeitlich geändert. Bitte neu laden.", 409);
            if (course.draft && JSON.stringify(course.draft) === JSON.stringify(draft)) {
                return { id: course.id, revision: course.revision };
            }
            course.revision++;
            course.draft = draft;
            course.audit.push({ action: "Entwurf gespeichert", actor: id, at: this.now() });
            if (!input.id) state.courses.push(course);
            return { id: course.id, revision: course.revision };
        });
    }

    publish(id, { courseId, revision }) {
        return this.actor(id, "author", (state) => {
            const course = this.course(state, courseId);
            check(course.revision === revision && course.draft, "Bitte den aktuellen Entwurf speichern und erneut veröffentlichen.", 409);
            const version = Rules.document(course.draft, true);
            check(version.purpose !== "privacy" || !state.courses.some((row) => row.id !== course.id && latest(row)?.purpose === "privacy"),
                "Für die Datenschutzkachel ist bereits eine andere Schulung veröffentlicht.");
            if (!course.versions.length) course.active = true;
            version.version = (latest(course)?.version || 0) + 1;
            version.publishedAt = this.now();
            version.publisher = id;
            course.versions.push(version);
            course.revision++;
            course.audit.push({ action: "Veröffentlicht", actor: id, at: version.publishedAt, version: version.version });
            course.draft = null;
            this.synchronize(state);
            return { id: course.id, version: version.version };
        });
    }

    setActive(id, { courseId, active, revision }) {
        return this.actor(id, "author", (state) => {
            const course = this.course(state, courseId);
            check(latest(course), "Bitte zuerst eine Version veröffentlichen.");
            check(course.revision === revision, "Die Schulung wurde zwischenzeitlich geändert. Bitte neu laden.", 409);
            course.active = active === true;
            course.revision++;
            course.audit.push({ action: course.active ? "Aktiviert" : "Deaktiviert", actor: id, at: this.now(),
                version: latest(course).version });
            this.synchronize(state);
        });
    }

    assign(id, input) {
        return this.actor(id, "manage", (state) => {
            const course = this.course(state, input.trainingId);
            check(course.active && latest(course), "Bitte eine aktive, veröffentlichte Schulung auswählen.");
            this.synchronize(state);
            if (input.mode === "group") {
                check(latest(course).mandatory, "Gruppenregeln gelten für Pflichtschulungen.");
                check(state.departments.some((row) => row.id === input.targetId), "Bitte eine Abteilung auswählen.");
                check(!state.groupRules.some((row) => row.courseId === course.id && row.departmentId === input.targetId),
                    "Für diese Abteilung besteht bereits eine Regel.", 409);
                state.groupRules.push({ id: this.makeId(), courseId: course.id, departmentId: input.targetId,
                    dueDays: integer(input.dueDays, "Frist", 1, 3650) });
                this.synchronize(state);
                return;
            }
            const employee = this.employee(state, input.targetId);
            check(Calendar.parse(input.dueOn) && input.dueOn >= this.today(), "Bitte eine Fälligkeit ab heute auswählen.");
            const current = state.assignments.find((row) => !row.closedOn && row.courseId === course.id && row.employeeId === employee.id);
            let renewedFrom;
            if (current && input.renewId === current.id) {
                const definition = published(course, current.version);
                const count = state.attempts.filter((row) => row.assignmentId === current.id).length;
                const locked = !current.completedOn && definition.maxAttempts && count >= definition.maxAttempts;
                check((current.validUntil && current.validUntil < this.today()) || locked, "Für diese Zuweisung ist keine Erneuerung möglich.");
                current.closedOn = this.today();
                current.closeReason = locked ? "attempt-limit" : "expired";
                renewedFrom = current.id;
            } else check(!current && !input.renewId, "Für diese Person besteht bereits eine aktuelle Zuweisung.", 409);
            state.assignments.push(this.newAssignment(course, employee.id, input.dueOn, "manual", { renewedFrom }));
        });
    }

    updateDue(id, { assignmentId, dueOn }) {
        return this.actor(id, "manage", (state) => {
            const row = state.assignments.find((item) => item.id === assignmentId);
            check(row && !row.completedOn && !row.closedOn, "Die Frist kann für diesen Durchlauf nicht geändert werden.");
            check(Calendar.parse(dueOn) && dueOn >= this.today(), "Bitte eine Fälligkeit ab heute auswählen.");
            row.dueOn = dueOn;
        });
    }

    removeAssignment(id, assignmentId) {
        return this.actor(id, "manage", (state) => {
            const row = state.assignments.find((item) => item.id === assignmentId);
            check(row && row.source === "manual" && !row.startedAt && !row.completedOn && !row.closedOn,
                "Nur unbegonnene Einzelzuweisungen können entfernt werden.");
            state.assignments = state.assignments.filter((item) => item.id !== assignmentId);
        });
    }

    removeRule(id, ruleId) {
        return this.actor(id, "manage", (state) => {
            state.groupRules = state.groupRules.filter((rule) => rule.id !== ruleId);
            state.assignments.filter((row) => row.groupRuleId === ruleId).forEach((row) => {
                delete row.groupRuleId;
                row.source = "manual";
            });
            this.synchronize(state);
        });
    }

    ownAssignment(state, id, assignmentId) {
        const row = state.assignments.find((item) => item.id === assignmentId);
        check(row && row.employeeId === id, "Diese Zuweisung gehört nicht zu Ihrem Konto.", 403);
        const course = this.course(state, row.courseId);
        return { row, course, version: published(course, row.version) };
    }

    retryState(attempts, version) {
        const limit = version.maxAttempts > 0 && attempts.length >= version.maxAttempts;
        const last = attempts.at(-1);
        const until = last && !last.passed ? Date.parse(last.at) + version.retryMinutes * 60000 : 0;
        return { limit, nextAt: until > this.clock().getTime() ? new Date(until).toISOString() : null };
    }

    learning(id, { assignmentId, start }) {
        return this.actor(id, null, (state) => {
            this.synchronize(state);
            const { row, course, version } = this.ownAssignment(state, id, assignmentId);
            if (!row.closedOn && !row.completedOn && course.active && start === true) row.startedAt ||= this.now();
            const attempts = state.attempts.filter((attempt) => attempt.assignmentId === row.id);
            const retry = this.retryState(attempts, version);
            const editable = !row.closedOn && !row.completedOn && course.active;
            const ready = editable && row.acknowledged.length === version.chapters.length;
            const canQuiz = ready && !retry.limit && !retry.nextAt;
            return {
                id: row.id, title: version.title, description: version.description, mandatory: version.mandatory,
                objectives: version.objectives, summary: version.summary, version: row.version,
                chapters: version.chapters, acknowledged: row.acknowledged, editable, ready, canQuiz,
                completedOn: row.completedOn, validUntil: row.validUntil, passPercent: version.passPercent,
                maxAttempts: version.maxAttempts, retry, attempts,
                questions: canQuiz ? version.questions.map((question) => ({
                    type: question.type, prompt: question.prompt, options: question.options.map((option) => option.text)
                })) : []
            };
        });
    }

    acknowledge(id, { assignmentId, version: requestVersion, chapter }) {
        return this.actor(id, null, (state) => {
            const { row, course, version } = this.ownAssignment(state, id, assignmentId);
            check(course.active && !row.completedOn && !row.closedOn, "Dieser Durchlauf ist geschlossen.");
            check(row.version === requestVersion, "Die Version der Schulung hat sich geändert. Bitte neu laden.", 409);
            check(Number.isInteger(chapter) && chapter >= 0 && chapter < version.chapters.length &&
                chapter <= row.acknowledged.length, "Bitte die Kapitel in der vorgesehenen Reihenfolge bearbeiten.");
            row.startedAt ||= this.now();
            if (chapter === row.acknowledged.length) row.acknowledged.push(chapter);
        });
    }

    submit(id, { assignmentId, version: requestVersion, answers }) {
        return this.actor(id, null, (state) => {
            const { row, course, version } = this.ownAssignment(state, id, assignmentId);
            check(course.active && !row.closedOn && !row.completedOn, "Dieser Durchlauf ist geschlossen.");
            check(row.version === requestVersion, "Die Version der Schulung hat sich geändert. Bitte neu laden.", 409);
            check(row.startedAt && row.acknowledged.length === version.chapters.length, "Bitte zuerst alle Kapitel bearbeiten.");
            const attempts = state.attempts.filter((attempt) => attempt.assignmentId === row.id);
            const retry = this.retryState(attempts, version);
            check(!retry.limit, "Das Versuchslimit ist erreicht.");
            check(!retry.nextAt, "Die Wartezeit zwischen Prüfungsversuchen läuft noch.");
            const result = Rules.score(version.questions, answers);
            const passed = result.points * 100 >= version.passPercent * result.maximum;
            const attempt = {
                id: this.makeId(), assignmentId: row.id, employeeId: id, courseId: course.id,
                version: row.version, at: this.now(), ...result, passed, number: attempts.length + 1
            };
            state.attempts.push(attempt);
            if (passed) {
                row.completedOn = this.today();
                row.validUntil = version.validityMonths ? Calendar.months(row.completedOn, version.validityMonths) : null;
            }
            return attempt;
        });
    }
}

module.exports = TrainingService;
