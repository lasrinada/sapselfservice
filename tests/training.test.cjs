const assert = require("node:assert/strict");
const { test } = require("node:test");
const { mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { createServer } = require("node:http");
const FileRepository = require("../server/FileRepository.cjs");
const Training = require("../server/training/TrainingService.cjs");
const seeds = require("../server/training/catalog.cjs");
const createState = require("../server/createState.cjs");
const { createMiddleware } = require("../server/middleware.cjs");
const { score } = require("../server/training/rules.cjs");

const clock = () => new Date(2026, 10, 20, 12, 0);

class MemoryRepository {
    state = createState(clock);
    async read(select) { return select(structuredClone(this.state)); }
    async transact(change) {
        const working = structuredClone(this.state);
        const result = change(working);
        this.state = working;
        return structuredClone(result);
    }
}

function fixture(repository = new MemoryRepository()) {
    let time = clock();
    const now = () => time;
    return { service: new Training(repository, now), repository, setTime: (value) => { time = new Date(value); } };
}

function course(title = "Qualität im Betrieb", fields = {}) {
    return { ...structuredClone(seeds[0]), title, purpose: "general", audience: "assigned", ...fields };
}

async function publish(service, draft, id, revision = 0) {
    const record = await service.saveDraft("E300", { id, revision, draft });
    return service.publish("E300", { courseId: record.id, revision: record.revision });
}

const correct = (seed) => seed.questions.map((question) => question.options.flatMap((row, index) => row.correct ? [index] : []));
const wrong = (seed) => seed.questions.map((question) => [question.options.findIndex((row) => !row.correct)]);
const answersFor = (seed, points) => correct(seed).map((row, index) => index < points ? row : wrong(seed)[index]);

async function find(service, employeeId, courseId) {
    const data = await service.overview(employeeId);
    return data.assignments.find((row) => row.own && row.trainingId === courseId && !row.closedOn);
}

async function learn(service, employeeId, row) {
    const course = await service.learning(employeeId, { assignmentId: row.id, start: true });
    for (const [chapter] of course.chapters.entries()) {
        await service.acknowledge(employeeId, { assignmentId: row.id, version: course.version, chapter });
    }
    return service.learning(employeeId, { assignmentId: row.id });
}

test("Katalog liefert vier vollständige Pflichtschulungen und genau eine Datenschutzkennung", async () => {
    const { service } = fixture();
    const required = seeds.filter((row) => row.mandatory);
    assert.equal(required.length, 4);
    assert.equal(required.filter((row) => row.purpose === "privacy").length, 1);
    for (const course of required) {
        assert.ok(course.description && course.objectives && course.summary);
        assert.ok(course.chapters.length >= 4);
        assert.equal(course.questions.length, 10);
        assert.deepEqual(new Set(course.questions.map((row) => row.type)), new Set(["single", "multiple"]));
        assert.equal(score(course.questions, correct(course)).points, 10);
        assert.equal(course.passPercent, 80);
    }
    const sample = [required[0].questions.find((row) => row.type === "multiple")];
    const selections = sample[0].options.flatMap((row, index) => row.correct ? [index] : []);
    assert.equal(score(sample, [[selections[0]]]).points, 0);
    assert.equal(score(sample, [[...selections, sample[0].options.findIndex((row) => !row.correct)]]).points, 0);
    for (const employee of ["E100", "E101", "E200", "E201", "E300", "E400"]) {
        const data = await service.overview(employee);
        assert.equal(data.assignments.filter((row) => row.own && row.active && row.mandatory && !row.closedOn).length, 4);
    }
});

test("Entwurf und Veröffentlichung werden validiert, Revision und Sichtbarkeit werden gewahrt", async () => {
    const { service } = fixture();
    const draft = await service.saveDraft("E300", { revision: 0, draft: course("Neue Schulung", { chapters: [], questions: [] }) });
    assert.ok((await service.overview("E300")).trainings.some((row) => row.id === draft.id && row.currentVersion === 0));
    assert.ok(!(await service.overview("E100")).trainings.some((row) => row.id === draft.id));
    await assert.rejects(service.publish("E300", { courseId: draft.id, revision: draft.revision }), /Kapitel und Quizfragen/);
    await assert.rejects(service.saveDraft("E300", { id: draft.id, revision: 0, draft: course() }), /zwischenzeitlich/);
    await assert.rejects(service.saveDraft("E300", { revision: 0, draft: course("Grenze", { passPercent: 79 }) }), /zwischen 80 und 100/);
    const live = await publish(service, course("Veröffentlicht"), draft.id, draft.revision);
    assert.equal(live.version, 1);
    const editor = await service.editor("E300", live.id);
    await service.setActive("E300", { courseId: live.id, active: false, revision: editor.revision });
    assert.equal((await service.overview("E300")).trainings.find((row) => row.id === live.id).active, false);
});

test("Neuer Mitarbeiter erhält Pflichtschulungen und Abteilungsregeln genau einmal", async () => {
    const { service } = fixture();
    const extra = await publish(service, course("IT-Unterweisung"));
    await service.assign("E201", { mode: "group", trainingId: extra.id, targetId: "IT", dueDays: 10 });
    const newPerson = await service.createEmployee("E300", {
        username: "neu", firstName: "Neue", lastName: "Person", departmentId: "IT", position: "Entwicklung", role: "admin"
    });
    assert.equal(newPerson.role, "employee");
    const overview = await service.overview(newPerson.id);
    assert.equal(overview.assignments.filter((row) => row.own).length, 5);
    assert.equal(overview.assignments.find((row) => row.trainingId === extra.id).dueOn, "2026-11-30");
    assert.equal((await service.overview("E200")).people.some((row) => row.id === newPerson.id), true);
    assert.equal((await service.overview("E101")).people.some((row) => row.id === newPerson.id), false);
    const rule = (await service.overview("E300")).groupRules[0];
    await service.removeRule("E201", rule.id);
    assert.ok(await find(service, newPerson.id, extra.id));
});

test("70 Prozent bleiben offen, 80 und 100 Prozent schließen nach vollständigen Kapiteln ab", async () => {
    const { service } = fixture();
    const seed = seeds[0];
    const anna = await find(service, "E100", seed.id);
    const attempt = (row, answers) => ({ assignmentId: row.id, version: row.version, answers });
    await assert.rejects(service.submit("E100", attempt(anna, correct(seed))), /zuerst alle Kapitel/);
    await assert.rejects(service.acknowledge("E100", { assignmentId: anna.id, version: 1, chapter: 1 }), /Reihenfolge/);
    const learner = await learn(service, "E100", anna);
    assert.ok(learner.questions.every((row) => !Object.hasOwn(row, "correct") && row.options.every((option) => typeof option === "string")));
    const failed = await service.submit("E100", { ...attempt(anna, answersFor(seed, 7)), passed: true, points: 100,
        completedOn: "2026-11-20", employeeId: "E300" });
    assert.deepEqual([failed.points, failed.percent, failed.passed, failed.number, failed.employeeId], [7, 70, false, 1, "E100"]);
    assert.equal((await find(service, "E100", seed.id)).completedText, "");
    const pass = await service.submit("E100", attempt(anna, answersFor(seed, 8)));
    assert.deepEqual([pass.points, pass.percent, pass.passed, pass.number], [8, 80, true, 2]);
    const done = await find(service, "E100", seed.id);
    assert.deepEqual([done.status, done.completedText, done.validText], ["complete", "20.11.2026", "20.11.2027"]);
    await assert.rejects(service.submit("E100", attempt(anna, correct(seed))), /geschlossen/);
    const jonas = await find(service, "E101", seed.id);
    await learn(service, "E101", jonas);
    assert.equal((await service.submit("E101", attempt(jonas, correct(seed)))).percent, 100);
    const history = (await service.overview("E300")).history.filter((row) => row.assignmentId === anna.id);
    assert.deepEqual(history.map((row) => [row.version, row.number, row.passed]), [[1, 2, true], [1, 1, false]]);
});

test("Wartezeit und Versuchslimit werden geprüft und Verwaltung kann einen neuen Durchlauf zuweisen", async () => {
    const { service, setTime } = fixture();
    const seed = course("Prüfungsregeln", { audience: "all", maxAttempts: 2, retryMinutes: 10 });
    const item = await publish(service, seed);
    const row = await find(service, "E100", item.id);
    await learn(service, "E100", row);
    const payload = { assignmentId: row.id, version: 1, answers: wrong(seed) };
    await service.submit("E100", payload);
    await assert.rejects(service.submit("E100", payload), /Wartezeit/);
    setTime(new Date(2026, 10, 20, 12, 11));
    await service.submit("E100", payload);
    assert.equal((await find(service, "E100", item.id)).canRenew, false);
    assert.equal((await service.overview("E300")).assignments.find((entry) => entry.id === row.id).canRenew, true);
    await assert.rejects(service.submit("E100", payload), /Versuchslimit/);
    await service.assign("E201", { trainingId: item.id, mode: "person", targetId: "E100",
        dueOn: "2026-11-30", renewId: row.id });
    assert.notEqual((await find(service, "E100", item.id)).id, row.id);
    assert.equal((await service.overview("E300")).history.filter((record) => record.assignmentId === row.id).length, 2);
});

test("Versionen bleiben unveränderlich und automatische Erneuerung liefert die aktuelle Version", async () => {
    const { service, setTime, repository } = fixture();
    const row = await find(service, "E100", "privacy");
    await learn(service, "E100", row);
    await service.submit("E100", { assignmentId: row.id, version: 1, answers: correct(seeds[0]) });
    const started = await find(service, "E101", "privacy");
    await service.learning("E101", { assignmentId: started.id, start: true });
    const editor = await service.editor("E300", "privacy");
    await publish(service, { ...editor.draft, title: "Datenschutz aktualisiert" }, "privacy", editor.revision);
    assert.equal((await find(service, "E100", "privacy")).version, 1);
    assert.equal((await find(service, "E101", "privacy")).version, 1);
    assert.equal((await find(service, "E201", "privacy")).version, 2);
    setTime(new Date(2027, 10, 20, 12));
    assert.equal((await find(service, "E100", "privacy")).status, "expiring");
    setTime(new Date(2027, 10, 21, 12));
    const next = await find(service, "E100", "privacy");
    assert.deepEqual([next.version, next.renewalRequired, next.lastCompleted, next.dueOn], [2, true, "20.11.2026", "2027-12-21"]);
    const history = (await service.overview("E300")).history.find((item) => item.assignmentId === row.id);
    assert.equal(history.title, seeds[0].title);
    assert.equal(history.version, 1);
    assert.equal((await repository.read((state) => state.assignments.find((item) => item.id === row.id))).closeReason, "expired");
});

test("Datei-Repository behält Entwurf, Zuweisung und Versuch bei einem Neustart", async (context) => {
    const workspace = await mkdtemp(join(tmpdir(), "portal-training-"));
    context.after(() => rm(workspace, { recursive: true, force: true }));
    const file = join(workspace, "db.json");
    const open = () => new Training(new FileRepository(file, () => createState(clock)), clock);
    const first = open();
    const saved = await first.saveDraft("E300", { revision: 0, draft: course("Gespeichert") });
    const assignment = await find(first, "E100", "privacy");
    await learn(first, "E100", assignment);
    await first.submit("E100", { assignmentId: assignment.id, version: 1, answers: correct(seeds[0]) });
    const restarted = open();
    assert.equal((await restarted.editor("E300", saved.id)).draft.title, "Gespeichert");
    assert.equal((await find(restarted, "E100", "privacy")).status, "complete");
    assert.equal((await restarted.overview("E300")).history.some((row) => row.assignmentId === assignment.id && row.points === 10), true);
});

test("HTTP-Demokonto kann keinen fremden Kurs, Administratorbefehl oder manuellen Abschluss aufrufen", async (context) => {
    const { service } = fixture();
    const app = createMiddleware(service);
    const server = createServer((req, res) => app(req, res, () => res.writeHead(404).end()));
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    context.after(() => new Promise((resolve) => server.close(resolve)));
    const url = "http://127.0.0.1:" + server.address().port + "/api/training/";
    const post = (action, data, token) => fetch(url + action, {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify(data)
    });
    assert.equal((await post("overview", {})).status, 401);
    assert.equal((await post("login", { username: "anna", password: "falsch" })).status, 401);
    const auth = await post("login", { username: "anna", password: "Demo2026!" });
    const { data: { token } } = await auth.json();
    assert.equal((await post("editor", { courseId: "privacy", actor: "E300" }, token)).status, 403);
    assert.equal((await post("saveDraft", { revision: 0, draft: course(), employeeId: "E300" }, token)).status, 403);
    assert.equal((await post("learning", { assignmentId: "demo-privacy-jonas" }, token)).status, 403);
    assert.equal((await post("complete", { assignmentId: "demo-privacy-anna", status: "Abgeschlossen" }, token)).status, 404);
    assert.equal((await find(service, "E100", "privacy")).completedText, "");
    assert.equal((await post("logout", {}, token)).status, 200);
    assert.equal((await post("overview", {}, token)).status, 401);
});
