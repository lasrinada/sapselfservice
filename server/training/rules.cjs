const Calendar = require("../amd.cjs")("domain/Calendar");

class RuleError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}

function check(condition, message, status) {
    if (!condition) throw new RuleError(message, status);
}

function text(value, label, max, required = true) {
    const result = typeof value === "string" ? value.trim() : "";
    check((!required || result.length > 0) && result.length <= max,
        label + " muss " + (required ? "1 bis " : "höchstens ") + max + " Zeichen enthalten.");
    return result;
}

function integer(value, label, min, max, fallback) {
    if (value == null || value === "") {
        if (fallback !== undefined) return fallback;
        throw new RuleError(label + " ist erforderlich.");
    }
    const number = Number(value);
    check(Number.isInteger(number) && number >= min && number <= max,
        label + " muss zwischen " + min + " und " + max + " liegen.");
    return number;
}

function items(value, max) {
    check(Array.isArray(value) && value.length <= max && value.every((row) => row && typeof row === "object"),
        "Die Liste enthält ungültige oder zu viele Einträge.");
    return value;
}

function document(input, publish = false) {
    check(input && typeof input === "object", "Schulungsdaten fehlen.");
    const mandatory = Boolean(input.mandatory);
    const validityMonths = integer(input.validityMonths, "Gültigkeit in Monaten", 1, 1200, null);
    const renewalDays = integer(input.renewalDays, "Frist für die Wiederholung", 1, 3650, null);
    check(!renewalDays || validityMonths, "Für eine automatische Wiederholung ist eine Gültigkeitsdauer erforderlich.");
    const chapters = items(input.chapters, 60).map((chapter, index) => {
        const label = "Kapitel " + (index + 1);
        const blocks = items(chapter.blocks, 80).map((block) => {
            check(["paragraph", "heading", "list", "note", "example"].includes(block.type), "Unbekanntes Inhaltsformat.");
            const value = text(block.text, "Inhaltsblock in " + label, 12000, publish);
            if (publish && block.type === "list") check(value.split("\n").some((line) => line.trim()), "Die Aufzählung ist leer.");
            return { type: block.type, text: value };
        });
        if (publish) check(blocks.length > 0, label + " benötigt mindestens einen Inhaltsblock.");
        return { title: text(chapter.title, label, 150, publish), blocks };
    });
    const questions = items(input.questions, 100).map((question, index) => {
        const label = "Frage " + (index + 1);
        check(["single", "multiple"].includes(question.type), label + " hat einen ungültigen Fragetyp.");
        const options = items(question.options, 12).map((option) => ({
            text: text(option.text, "Antwortoption in " + label, 500, publish), correct: Boolean(option.correct)
        }));
        if (publish) {
            const count = options.filter((option) => option.correct).length;
            check(options.length >= 2 && new Set(options.map((option) => option.text)).size === options.length,
                label + " benötigt mindestens zwei unterschiedliche Antwortmöglichkeiten.");
            check(count < options.length && (question.type === "single" ? count === 1 : count >= 2),
                label + " benötigt " + (question.type === "single" ? "genau eine richtige Antwort." :
                    "mindestens zwei richtige und eine falsche Antwort."));
        }
        return { type: question.type, prompt: text(question.prompt, label, 350, publish), options };
    });
    if (publish) check(chapters.length && questions.length, "Zur Veröffentlichung sind Kapitel und Quizfragen erforderlich.");
    return {
        title: text(input.title, "Titel", 120),
        category: text(input.category, "Kategorie", 80, publish),
        description: text(input.description, "Beschreibung", 1500, publish),
        objectives: text(input.objectives, "Lernziele", 3000, publish),
        summary: text(input.summary, "Zusammenfassung", 4000, publish),
        purpose: input.purpose === "privacy" ? "privacy" : "general",
        mandatory,
        audience: mandatory && input.audience === "all" ? "all" : "assigned",
        dueDays: integer(input.dueDays, "Standardfrist", 1, 3650, 30),
        validityMonths,
        renewalDays,
        passPercent: integer(input.passPercent, "Bestehensgrenze", 80, 100, 80),
        maxAttempts: integer(input.maxAttempts, "Versuchslimit", 0, 100, 0),
        retryMinutes: integer(input.retryMinutes, "Wartezeit in Minuten", 0, 10080, 0),
        chapters, questions
    };
}

function score(questions, answers) {
    check(Array.isArray(answers) && answers.length === questions.length, "Bitte alle Fragen beantworten.");
    const points = questions.reduce((total, question, index) => {
        const selected = answers[index];
        check(Array.isArray(selected) && selected.length > 0 &&
            (question.type !== "single" || selected.length === 1) &&
            new Set(selected).size === selected.length &&
            selected.every((choice) => Number.isInteger(choice) && choice >= 0 && choice < question.options.length),
        "Bitte die Antwortauswahl in Frage " + (index + 1) + " prüfen.");
        const expected = question.options.flatMap((option, i) => option.correct ? [i] : []);
        return total + Number(selected.length === expected.length && expected.every((choice) => selected.includes(choice)));
    }, 0);
    return { points, maximum: questions.length, percent: Math.floor(points * 10000 / questions.length) / 100 };
}

function classify(row, course, today) {
    if (row.closedOn) return ["history", "Vorheriger Durchlauf", "None"];
    if (row.validUntil && row.validUntil < today) return ["expired", "Abgelaufen", "Error"];
    if (!course.active && !row.completedOn) return ["inactive", "Inaktiv", "None"];
    if (row.completedOn) {
        return row.validUntil && row.validUntil <= plusDays(today, 30) ?
            ["expiring", "Läuft bald ab", "Warning"] : ["complete", "Abgeschlossen", "Success"];
    }
    if (row.dueOn < today) return ["overdue", "Überfällig", "Error"];
    if (row.dueOn <= plusDays(today, 7)) return ["dueSoon", "Bald fällig", "Warning"];
    return row.startedAt ? ["started", "Begonnen", "Information"] : ["open", "Offen", "Information"];
}

function plusDays(date, days) {
    return Calendar.shift(Calendar.parse(date), days);
}

module.exports = { Calendar, RuleError, check, text, integer, document, score, classify, plusDays };
