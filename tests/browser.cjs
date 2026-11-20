const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { mkdir, mkdtemp, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");
const { createServer } = require("node:net");
const { chromium } = require("playwright-core");
const seeds = require("../server/training/catalog.cjs");

const password = "Demo2026!";
const root = resolve(__dirname, "..");

async function availablePort() {
    const server = createServer();
    await new Promise((done) => server.listen(0, "127.0.0.1", done));
    const port = server.address().port;
    await new Promise((done) => server.close(done));
    return port;
}

async function start(directory) {
    const port = await availablePort();
    const base = "http://localhost:" + port;
    const child = spawn(process.execPath, [join(root, "node_modules/@ui5/cli/bin/ui5.cjs"),
        "serve", "--accept-remote-connections=false", "--port", String(port)], {
        cwd: root, env: { ...process.env, PORTAL_TRAINING_STATE: join(directory, "training.json") },
        windowsHide: true
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    try {
        for (let attempt = 0; attempt < 350; attempt++) {
            if (child.exitCode !== null) break;
            try {
                if ((await fetch(base + "/api/training/options", { method: "POST" })).ok) return { child, base };
            } catch { /* UI5 server is still starting. */ }
            await new Promise((done) => setTimeout(done, 250));
        }
        throw new Error(output || "UI5-Testserver konnte nicht gestartet werden.");
    } catch (error) {
        child.kill();
        throw error;
    }
}

const text = (page, value) => page.getByText(value, { exact: true }).filter({ visible: true }).first();
const button = (page, name) => page.getByRole("button", { name, exact: true }).filter({ visible: true }).first();

async function capture(page, label) {
    if (!process.env.PORTAL_QA_SCREENSHOTS) return;
    const folder = process.env.PORTAL_QA_SCREENSHOTS;
    await mkdir(folder, { recursive: true });
    await page.screenshot({ path: join(folder, label + ".png"), animations: "disabled" });
}

async function route(page, hash, target) {
    await page.evaluate((value) => { location.hash = value; }, hash);
    await target.waitFor();
}

async function login(page, base, username, name) {
    page.setDefaultTimeout(40000);
    page.on("pageerror", (error) => console.error("Browser:", error.message));
    await page.goto(base + "/index.html");
    await page.getByLabel("Benutzername", { exact: true }).fill(username);
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    await button(page, "Anmelden").click();
    await page.getByRole("heading", { name: "Willkommen, " + name }).waitFor();
    await page.getByRole("heading", { name: "Ihre Anwendungen" }).waitFor();
}

async function quiz(page, seed, points) {
    await button(page, "Abschlussquiz starten").click();
    await page.locator(".quizQuestion").first().waitFor();
    for (const [index, question] of seed.questions.entries()) {
        const card = page.locator(".quizQuestion").nth(index);
        const correct = question.options.flatMap((row, choice) => row.correct ? [choice] : []);
        const selected = index < points ? correct : [question.options.findIndex((row) => !row.correct)];
        for (const choice of selected) {
            await card.getByRole(question.type === "single" ? "radio" : "checkbox").nth(choice).click();
        }
    }
    await button(page, "Quiz verbindlich einreichen").click();
    await page.getByText(new RegExp(points + " von 10 Punkten")).waitFor();
}

async function finishChapters(page, count) {
    for (let index = 0; index < count; index++) {
        await button(page, "Kapitel als gelesen bestätigen").click();
        await text(page, (index + 1) + " von " + count + " Kapiteln").waitFor();
    }
}

async function learner(browser, base) {
    const page = await browser.newPage({ viewport: { width: 1450, height: 920 } });
    try {
        await login(page, base, "anna", "Anna");
        const visible = ["Abwesenheitsanträge", "Zeiterfassung", "Schulungen", "Datenschutz", "Entgeltnachweise",
            "Lohnsteuerbescheinigungen", "Mitarbeiterverzeichnis", "Familie und Notfallkontakt", "Mein Profil"];
        for (const title of visible) await page.getByRole("heading", { name: title, exact: true }).waitFor();
        await capture(page, "dashboard");
        await page.getByRole("heading", { name: "Datenschutz", exact: true }).click();
        await page.getByRole("heading", { name: "1. Grundlagen des Datenschutzes", exact: true }).waitFor();
        assert.equal(await button(page, "Abschlussquiz starten").count(), 0);
        await finishChapters(page, seeds[0].chapters.length);
        await quiz(page, seeds[0], 7);
        await page.getByText(/Nicht bestanden\. Erforderlich sind 80/).waitFor();
        await quiz(page, seeds[0], 8);
        await page.getByText(/Bestanden\. Ihr Abschluss wurde gespeichert/).waitFor();
        await page.reload();
        await page.getByText(/Abgeschlossen am/).filter({ visible: true }).first().waitFor();
        await route(page, "Main", page.getByRole("heading", { name: "Ihre Anwendungen" }));
        await page.setViewportSize({ width: 390, height: 844 });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        await capture(page, "mobile");
        await page.getByRole("heading", { name: "Abwesenheitsanträge", exact: true }).click();
        await button(page, "Antrag hinzufügen").click();
        await page.locator("[id$='--Zeitraum-inner']").waitFor();
        await page.evaluate(() => {
            const input = document.querySelector("[id$='--Zeitraum-inner']");
            const picker = sap.ui.getCore().byId(input.id.replace(/-inner$/, ""));
            const date = new Date();
            date.setDate(date.getDate() + 1);
            while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
            picker.setDateValue(date);
            picker.setSecondDateValue(date);
        });
        await button(page, "Sichern").click();
        await text(page, "Antrag eingereicht.").waitFor();
        await page.setViewportSize({ width: 1450, height: 920 });
        await route(page, "TimeTracking", text(page, "08:00"));
        await text(page, "Zeiterfassung anlegen").click();
        await button(page, "Eintrag Hinzufügen").click();
        for (const [index, id] of ["timePicker1s", "timePicker1e", "timePicker2s", "timePicker2e"].entries()) {
            await page.locator("[id*='--" + id + "'][id$='-inner']").filter({ visible: true }).fill(["07:00", "11:00", "12:00", "16:30"][index]);
        }
        await button(page, "Speichern").click();
        await text(page, "07:00").waitFor();
        await route(page, "Profile", page.locator("[id$='firstNameInput-inner']"));
        await button(page, "Bearbeiten").click();
        const firstName = page.locator("[id$='firstNameInput-inner']");
        await firstName.fill("Anne");
        await firstName.press("Tab");
        await page.getByRole("button", { name: "Speichern", exact: true }).filter({ visible: true }).first().click();
        await text(page, "Änderungen gespeichert.").waitFor();
        await route(page, "FamilyMembers", text(page, "Mia Keller"));
        await button(page, "Familienmitglied hinzufügen").click();
        await page.getByRole("dialog", { name: "Familienmitglied hinzufügen" }).waitFor();
        await button(page, "Abbrechen").click();
        await button(page, "Bearbeiten").click();
        const name = page.locator("[id$='--emergencyContactName-inner']");
        await name.fill("Alex Test");
        await name.press("Tab");
        await button(page, "Speichern").click();
        await text(page, "Notfallkontakt gespeichert.").waitFor();
        await route(page, "EmployeeDirectory", text(page, "Alex Test · +49 30 000000"));
        await page.getByRole("searchbox").fill("Jonas");
        await text(page, "IT-Support").waitFor();
        for (const [hash, period] of [["PayStatements", "12.2024"], ["TaxStatements", "2024"]]) {
            await route(page, hash, text(page, period));
            const pdfTable = page.locator(hash === "PayStatements" ? "[id$='--payStatementTable']" : "[id$='--taxStatementTable']");
            await pdfTable.locator("button").filter({ hasText: "Anzeigen" }).first().click();
            const link = page.getByRole("link", { name: "PDF im Browser öffnen" });
            const file = await page.request.get(new URL(await link.getAttribute("href"), page.url()).href);
            assert.equal(file.headers()["content-type"], "application/pdf");
            assert.equal((await file.body()).subarray(0, 5).toString(), "%PDF-");
            await button(page, "Schließen").click();
            await link.waitFor({ state: "hidden" });
        }
        await page.evaluate(() => { location.hash = "TrainingEditor/new"; });
        await page.waitForURL(/#\/?Main$/);
        console.log("Browser: Kacheln, Datenschutz, 70/80 Prozent, Reload, mobile Abwesenheit, HR-Daten, PDF und Routenschutz.");
    } catch (error) {
        console.error("Ansicht bei Fehler:", page.url(), await page.locator("body").innerText());
        throw error;
    } finally { await page.close(); }
}

async function administrator(browser, base) {
    const page = await browser.newPage({ viewport: { width: 1450, height: 920 } });
    try {
        await login(page, base, "admin", "Daniel");
        await page.getByRole("heading", { name: "Abwesenheiten genehmigen", exact: true }).waitFor();
        await route(page, "AbsenceOverviewManager", text(page, "Anna Keller"));
        await button(page, "Details").click();
        await page.getByRole("dialog", { name: "Details zur Abwesenheit" }).waitFor();
        await button(page, "Schließen").click();
        await page.getByRole("row").filter({ hasText: "Anna Keller" }).getByRole("button", { name: "Genehmigen" }).first().click();
        await text(page, "Antrag genehmigt.").waitFor();
        await route(page, "Training", text(page, "Schulungen und Fristen"));
        await text(page, "Katalog").click();
        await button(page, "Schulung anlegen").click();
        for (const [label, value] of [["Titel", "Browser-Unterweisung"], ["Kategorie", "Qualität"], ["Beschreibung", "Arbeitsabläufe sicher dokumentieren."],
            ["Lernziele", "Dokumentation prüfen."], ["Zusammenfassung", "Zeitnah dokumentieren."]]) {
            const field = page.getByLabel(label, { exact: true }).filter({ visible: true }).first();
            await field.fill(value);
            await field.press("Tab");
        }
        await text(page, "Kapitel").click();
        await button(page, "Kapitel hinzufügen").click();
        await page.getByLabel("Kapiteltitel", { exact: true }).fill("Dokumentation");
        await page.getByLabel("Inhalt", { exact: true }).fill("Erfassen Sie Datum und beobachtete Abweichung.");
        await text(page, "Quiz").click();
        await button(page, "Frage hinzufügen").click();
        await page.getByLabel("Fragestellung", { exact: true }).fill("Was gehört in einen Bericht?");
        await page.getByLabel("Antwort 1", { exact: true }).fill("Datum und beobachteter Sachverhalt");
        await page.getByLabel("Antwort 2", { exact: true }).fill("Vermutungen ohne Beleg");
        await button(page, "Entwurf speichern").click();
        await page.waitForURL(/TrainingEditor\/[a-f\d-]{36}/);
        await page.reload();
        assert.equal(await page.getByLabel("Titel", { exact: true }).inputValue(), "Browser-Unterweisung");
        await button(page, "Veröffentlichen").click();
        await button(page, "OK").click();
        await text(page, "Version veröffentlicht.").waitFor();
        await text(page, "Versionen").click();
        await text(page, "Version 1 · Browser-Unterweisung").waitFor();
        await text(page, "Stammdaten").click();
        const description = page.getByLabel("Beschreibung", { exact: true }).filter({ visible: true }).first();
        await description.fill("Überarbeitete Beschreibung für den zweiten Stand.");
        await description.press("Tab");
        await button(page, "Entwurf speichern").click();
        await text(page, "Entwurf gespeichert.").waitFor();
        await page.reload();
        assert.equal(await description.inputValue(), "Überarbeitete Beschreibung für den zweiten Stand.");
        await button(page, "Veröffentlichen").click();
        await button(page, "OK").click();
        await text(page, "Version veröffentlicht.").waitFor();
        await text(page, "Versionen").click();
        await text(page, "Version 2 · Browser-Unterweisung").waitFor();
        await text(page, "Version 1 · Browser-Unterweisung").waitFor();
        await capture(page, "editor");
        await route(page, "Training", text(page, "Schulungen und Fristen"));
        await text(page, "Katalog").click();
        await button(page, "Demomitarbeiter anlegen").click();
        for (const [label, value] of [["Vorname", "Browser"], ["Nachname", "Test"], ["Benutzername", "browsertest"], ["Funktion", "Entwicklung"]]) {
            await page.getByRole("dialog").getByLabel(label, { exact: true }).fill(value);
        }
        await button(page, "Mitarbeiter anlegen").click();
        await text(page, "Demomitarbeiter angelegt und Pflichtschulungen zugeordnet.").waitFor();
        await text(page, "Prüfungshistorie").click();
        await page.getByText(/8\/10 · 80 % · Bestanden/).waitFor();
        console.log("Browser: Genehmigung und Details, dynamischer Kapitel- und Quizeditor, Veröffentlichung, Historie und Demomitarbeiter.");
    } finally { await page.close(); }
}

async function newcomer(browser, base) {
    const page = await browser.newPage();
    try {
        await login(page, base, "browsertest", "Browser");
        await route(page, "Training", text(page, "Schulungen und Fristen"));
        for (const course of seeds.filter((row) => row.mandatory)) await text(page, course.title).waitFor();
        const row = page.getByRole("row").filter({ hasText: seeds[0].title });
        await row.getByRole("button", { name: "Schulung öffnen" }).click();
        await finishChapters(page, seeds[0].chapters.length);
        await quiz(page, seeds[0], 10);
        await page.getByText(/Bestanden\. Ihr Abschluss wurde gespeichert/).waitFor();
        console.log("Browser: neuer Mitarbeiter mit vier Pflichtkursen und 100-Prozent-Abschluss.");
    } finally { await page.close(); }
}

async function main() {
    const directory = await mkdtemp(join(tmpdir(), "portal-ui5-browser-"));
    let server;
    let browser;
    try {
        server = await start(directory);
        const executablePath = process.env.PORTAL_BROWSER;
        browser = await chromium.launch(executablePath ? { executablePath } : { channel: "msedge" });
        await learner(browser, server.base);
        await administrator(browser, server.base);
        await newcomer(browser, server.base);
    } finally {
        await browser?.close();
        if (server?.child.exitCode === null) {
            const exit = new Promise((done) => server.child.once("exit", done));
            server.child.kill();
            await exit;
        }
        await rm(directory, { recursive: true, force: true });
    }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
