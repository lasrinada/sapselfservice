sap.ui.define([
    "../BaseController", "sap/m/Text", "sap/m/Title", "sap/m/List", "sap/m/StandardListItem",
    "sap/m/MessageStrip", "sap/m/VBox", "sap/m/RadioButtonGroup", "sap/m/RadioButton", "sap/m/CheckBox",
    "sapselfservice/domain/Calendar"
], function (Base, Text, Title, List, StandardListItem, MessageStrip, VBox, RadioButtonGroup, RadioButton, CheckBox, Calendar) {
    "use strict";

    const plain = (Control, value, settings) => new Control(settings).setText(value);

    return Base.extend("sapselfservice.controller.Learning.Course", {
        onInit() {
            this.model("learn", { progress: 0, chapters: [] });
            this.observe("Learn", function (event) {
                const { assignmentId, step } = event.getParameter("arguments");
                return this.load(assignmentId, true, step);
            });
        },

        async load(id, start, preferred) {
            const course = await this.training().learning(id, start);
            this.current = course;
            const count = course.acknowledged.length;
            const status = course.completedOn ? "Abgeschlossen" : course.editable ? "In Bearbeitung" : "Archiviert oder inaktiv";
            this.model("learn", {
                ...course, progress: Math.round(count * 100 / course.chapters.length),
                progressText: count + " von " + course.chapters.length + " Kapiteln",
                status, statusTone: course.completedOn ? "Success" : "Information",
                completion: Calendar.display(course.completedOn), validity: Calendar.display(course.validUntil),
                versionText: "Version " + course.version + (course.mandatory ? " · Pflichtschulung" : " · Optional"),
                attempts: [...course.attempts].reverse().map((row) => ({
                    ...row, date: new Date(row.at).toLocaleString("de-DE"),
                    result: row.points + "/" + row.maximum + " · " + row.percent + " % · " +
                        (row.passed ? "Bestanden" : "Nicht bestanden")
                })),
                chapterList: course.chapters.map((chapter, index) => ({
                    title: chapter.title, index, status: index < count ? "Bearbeitet" :
                        course.editable && index > count ? "Gesperrt" : "Offen",
                    state: index < count ? "Success" : "None",
                    type: !course.editable || index <= count ? "Active" : "Inactive"
                })),
                retryMessage: course.retry.limit && !course.completedOn ? "Das Versuchslimit ist erreicht. Die Schulungsverwaltung kann einen neuen Durchlauf zuweisen." :
                    course.retry.nextAt ? "Ein weiterer Versuch ist ab " + new Date(course.retry.nextAt).toLocaleString("de-DE") + " möglich." : "",
                quizRequirement: "Für den Abschluss sind mindestens " + course.passPercent +
                    " % erforderlich. Bei Multiple Choice zählt nur die exakt richtige Auswahl."
            });
            this.byId("questionList").destroyItems();
            if (preferred === "quiz" && course.canQuiz) this.renderQuiz();
            else if (preferred === "overview" || (!preferred && !course.editable)) this.setSection("overview");
            else {
                const requested = /^\d+$/.test(preferred || "") ? Number(preferred) : -1;
                const index = requested >= 0 && requested < course.chapters.length &&
                    (!course.editable || requested <= count) ? requested : Math.min(count, course.chapters.length - 1);
                this.renderChapter(index);
            }
        },

        setSection(section) { this.model("learn").setProperty("/section", section); },
        onNavBack() { this.nav("Training"); },
        onOverview() { this.setSection("overview"); },

        onChapter(event) {
            const row = event.getSource().getBindingContext("learn").getObject();
            if (row.type === "Active") this.renderChapter(row.index);
        },

        renderChapter(index) {
            const model = this.model("learn");
            const course = this.current;
            const chapter = course.chapters[index];
            this.chapterIndex = index;
            this.setSection("chapter");
            model.setProperty("/chapterTitle", (index + 1) + ". " + chapter.title);
            model.setProperty("/canAcknowledge", course.editable && index === course.acknowledged.length);
            const container = this.byId("chapterBlocks");
            container.destroyItems();
            chapter.blocks.forEach((block) => {
                let item;
                switch (block.type) {
                    case "heading":
                        item = plain(Title, block.text, { level: "H3", wrapping: true });
                        break;
                    case "note":
                    case "example":
                        item = plain(MessageStrip,
                            (block.type === "example" ? "Praxisbeispiel" : "Hinweis") + " · " + block.text,
                            { type: "Information", showIcon: true });
                        break;
                    case "list":
                        item = new List({ showSeparators: "None", items: block.text.split("\n")
                            .map((line) => line.trim()).filter(Boolean)
                            .map((line) => new StandardListItem({ wrapping: true }).setTitle("• " + line)) });
                        break;
                    default:
                        item = plain(Text, block.text, { wrapping: true });
                }
                container.addItem(item);
            });
        },

        onAcknowledge() {
            return this.run(async function () {
                const { id, version, chapters } = this.current;
                const index = this.chapterIndex;
                await this.training().acknowledge(id, version, index);
                await this.load(id, false, index + 1 < chapters.length ? String(index + 1) : "overview");
            });
        },

        onQuiz() {
            return this.run(async function () {
                await this.load(this.current.id, false, "quiz");
                if (!this.current.canQuiz) this.setSection("overview");
            });
        },

        onRefresh() { return this.run(() => this.load(this.current.id, false, "overview")); },

        renderQuiz() {
            this.setSection("quiz");
            const container = this.byId("questionList");
            container.destroyItems();
            this.answerReaders = this.current.questions.map((question, index) => {
                const heading = plain(Title, (index + 1) + ". " + question.prompt,
                    { level: "H3", wrapping: true });
                const card = new VBox({ items: [heading] }).addStyleClass("quizQuestion");
                container.addItem(card);
                if (question.type === "single") {
                    const group = new RadioButtonGroup({ columns: 1, selectedIndex: -1, width: "100%",
                        buttons: question.options.map((option) => plain(RadioButton, option)) });
                    group.addAriaLabelledBy(heading);
                    card.addItem(group);
                    return () => group.getSelectedIndex() < 0 ? [] : [group.getSelectedIndex()];
                }
                card.addItem(new Text({ text: "Mehrere Antworten möglich" }));
                const choices = question.options.map((option) => plain(CheckBox, option, { wrapping: true }));
                choices.forEach((choice) => card.addItem(choice));
                return () => choices.flatMap((choice, number) => choice.getSelected() ? [number] : []);
            });
        },

        onSubmit() {
            return this.run(async function () {
                const { id, version, passPercent } = this.current;
                const answers = this.answerReaders.map((read) => read());
                if (answers.some((row) => !row.length)) throw new Error("Bitte beantworten Sie alle Quizfragen.");
                const result = await this.training().submit(id, version, answers);
                const prefix = result.points + " von " + result.maximum + " Punkten · " + result.percent + " %. ";
                await this.load(id, false, "overview");
                this.model("learn").setProperty("/result", prefix + (result.passed ?
                    "Bestanden. Ihr Abschluss wurde gespeichert." :
                    "Nicht bestanden. Erforderlich sind " + passPercent + " %. Der Versuch wurde gespeichert."));
                this.model("learn").setProperty("/resultType", result.passed ? "Success" : "Warning");
                this.byId("coursePage").scrollTo(0, 0);
            });
        }
    });
});
