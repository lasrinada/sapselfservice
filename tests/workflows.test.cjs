const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const cache = new Map();
const webapp = path.resolve(__dirname, "../webapp");

function load(module) {
    if (!cache.has(module)) {
        const source = fs.readFileSync(path.join(webapp, module + ".js"), "utf8");
        const sap = { ui: { define(dependencies, factory) {
            cache.set(module, factory(...dependencies.map((dependency) => load(dependency.startsWith(".") ?
                path.posix.normalize(path.posix.join(path.posix.dirname(module), dependency)) :
                dependency.replace(/^sapselfservice\//, "")))));
        } } };
        new Function("sap", source)(sap);
    }
    return cache.get(module);
}

const Calendar = load("domain/Calendar");
const Demo = load("data/DemoData");
const LocalRepository = load("data/LocalRepository");
const HrService = load("service/HrService");
const day = new Date(2026, 10, 20, 12, 0);
const today = Calendar.key(day);

test("Lesender Zugriff behält das unbenannte View-Modell und seine Formulardaten", () => {
    const source = fs.readFileSync(path.join(webapp, "controller/BaseController.js"), "utf8");
    let controller;
    class ViewModel {
        constructor(data) { this.data = data; }
        setSizeLimit() {}
    }
    const viewModels = new Map();
    const view = {
        getModel: (name) => viewModels.get(name),
        setModel: (model, name) => viewModels.set(name, model)
    };
    const sap = { ui: { define(_dependencies, factory) {
        controller = factory({ extend: (_name, methods) => methods }, ViewModel);
    } } };
    new Function("sap", source)(sap);
    controller.getView = () => view;
    const initial = controller.model(undefined, { selectedRadioButton: "moreThanOneDay" });
    assert.equal(controller.model(), initial);
    assert.equal(controller.model().data.selectedRadioButton, "moreThanOneDay");
});

function setup() {
    const records = new Map([["sapselfservice.demo.v1", JSON.stringify(Demo(day))]]);
    const storage = { getItem: (key) => records.get(key), setItem: (key, value) => records.set(key, value) };
    const repo = new LocalRepository(storage);
    let sequence = 0;
    let current = day;
    const hr = new HrService(repo, () => current, () => "test-" + ++sequence);
    return { hr, repo, setDate: (value) => { current = Calendar.parse(value); } };
}

test("Profil, synchronisierte Beschäftigte, Verzeichnis, Familie und Notfallkontakt", async () => {
    const { hr } = setup();
    const id = "E100";
    await hr.syncPeople([{ id: "test-person", firstName: "Neue", lastName: "Person", role: "employee", departmentId: "IT" }]);
    assert.ok((await hr.directory(id)).some((row) => row.Vorname === "Neue"));
    await hr.saveProfile(id, "personal", { ...await hr.profile(id), Vorname: "Anne", Hausnummer: "15a" });
    await hr.saveProfile(id, "bank", { IBAN: "DE00 1234 5678 0000 0000 00", BIC: "testdebb" });
    assert.equal((await hr.session(id)).name, "Anne Keller");
    assert.equal((await hr.profile(id)).Hausnummer, "15a");
    await hr.saveFamilyMember(id, { Name: "Testperson", Beziehung: "Vater", Geburtsdatum: "1961-01-31" });
    const member = (await hr.family(id)).familyMembers.find((row) => row.Name === "Testperson");
    assert.equal(member.Geburtsdatum, "31.01.1961");
    await hr.removeFamilyMember(id, member.id);
    await hr.saveContact(id, { Name: "Kontakt", Telefonnummer: "+49 30 555555" });
    assert.equal((await hr.directory(id)).find((user) => user.Vorname === "Anne").emergencyContactName, "Kontakt");
    assert.equal((await hr.documents(id, "pay")).length, 4);
    assert.equal((await hr.documents(id, "tax")).length, 4);
});

test("Abwesenheit beantragen, berechtigte Führungskraft entscheidet und Vertretung greift", async () => {
    const { hr } = setup();
    assert.equal((await hr.absenceForm("E100")).quota, 12);
    await assert.rejects(hr.requestAbsence("E100", { typeId: "remote-weekend", from: today, to: today,
        start: "08:00", end: "12:00" }), /Samstag oder Sonntag/);
    await hr.requestAbsence("E100", { typeId: "vacation", range: true, from: "2026-11-23", to: "2026-11-25", note: "QA" });
    const team = await hr.absenceRows("E200", "team");
    const request = team.find((row) => row.Kommentare === "QA");
    assert.equal(request.DisplayName, "Anna Keller");
    await assert.rejects(hr.decideAbsence("E101", request.docId, true), /Berechtigung/);
    await hr.decideAbsence("E200", request.docId, true);
    assert.ok((await hr.absenceRows("E100", "decided")).some((row) => row.docId === request.docId && row.Status === "Genehmigt"));
    assert.ok((await hr.absenceRows("E400", "team")).some((row) => row.docId === "r6"));
    await assert.rejects(hr.absenceForm("E400"), /Berechtigung/);
});

test("Zeiterfassung berechnet Pausen und speichert nur vollständig gültige Stapel", async () => {
    const { hr } = setup();
    const valid = { date: "2026-11-21", session1Start: "08:00", session1End: "12:00",
        session2Start: "13:00", session2End: "17:00" };
    await assert.rejects(hr.saveTimeEntries("E100", [valid, { ...valid, date: "2026-11-22",
        session2Start: "11:00" }]), /Reihenfolge/);
    assert.equal((await hr.timeEntries("E100", "2026-11")).length, 1);
    await hr.saveTimeEntries("E100", [valid]);
    const rows = await hr.timeEntries("E100", "2026-11");
    assert.equal(rows[1].Stundengesamt, "8.00");
    assert.equal(rows[1].Pausendauer, "1.00");
    await assert.rejects(hr.saveTimeEntries("E100", [valid, valid]), /genau einen/);
});
