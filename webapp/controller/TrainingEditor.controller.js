sap.ui.define([
    "./BaseController", "sap/m/MessageBox", "sap/m/Label", "sap/m/Input", "sap/m/TextArea",
    "sap/m/Select", "sap/ui/core/Item", "sap/m/CheckBox", "sap/m/Button", "sap/m/VBox",
    "sap/m/FlexBox", "sap/m/Title"
], function (Base, MessageBox, Label, Input, TextArea, Select, Item, CheckBox, Button, VBox, FlexBox, Title) {
    "use strict";

    const blank = () => ({
        title: "", category: "", description: "", objectives: "", summary: "", purpose: "general",
        mandatory: false, audience: "assigned", validityMonths: "", renewalDays: "", dueDays: 30,
        passPercent: 80, maxAttempts: 0, retryMinutes: 0, chapters: [], questions: []
    });
    const formatNames = {
        paragraph: "Absatz", heading: "Überschrift", list: "Aufzählung · eine Zeile pro Punkt",
        note: "Hinweis", example: "Praxisbeispiel"
    };
    const pathBinding = (path) => "{draft>" + path + "}";

    return Base.extend("sapselfservice.controller.TrainingEditor", {
        onInit() {
            this.model("draft", blank());
            this.model("editor", { key: "general", versions: [], audit: [], sections: {} });
            this.observe("TrainingEditor", function (event) {
                return this.loadCourse(event.getParameter("arguments").courseId);
            });
        },

        async loadCourse(id) {
            const current = id === "new" ? { id: null, draft: blank(), revision: 0, versions: [], audit: [] } :
                await this.training().editor(id);
            this.current = current;
            this.selected = { chapters: 0, questions: 0 };
            this.model("draft", current.draft);
            this.model("editor", { ...current, draft: undefined, key: "general",
                versions: current.versions.map((row) => ({ ...row, date: this.date(row.publishedAt) })),
                audit: current.audit.map((row) => ({ ...row, date: this.date(row.at) })) });
            this.byId("editorPage").setTitle(id === "new" ? "Schulung anlegen" : "Schulung bearbeiten");
            this.renderSection("chapters");
            this.renderSection("questions");
        },

        date(value) { return new Date(value).toLocaleString("de-DE"); },
        onNavBack() { this.nav("Training"); },
        onTab(event) { this.model("editor").setProperty("/key", event.getParameter("key")); },
        onAddChapter() { this.add("chapters", { title: "", blocks: [{ type: "paragraph", text: "" }] }); },
        onAddQuestion() { this.add("questions", { prompt: "", type: "single", options: [
            { text: "", correct: true }, { text: "", correct: false }
        ] }); },

        add(section, row) {
            const model = this.model("draft");
            const rows = model.getProperty("/" + section);
            model.setProperty("/" + section, [...rows, row]);
            this.selected[section] = rows.length;
            this.renderSection(section);
        },

        button(text, press, enabled = true) {
            return new Button({ text, press, enabled });
        },

        confirm(message, action) {
            MessageBox.confirm(message, {
                onClose: (choice) => { if (choice === MessageBox.Action.OK) action(); }
            });
        },

        field(label, control) {
            return [new Label({ text: label, labelFor: control }), control];
        },

        renderSection(section) {
            const container = this.byId(section === "chapters" ? "chapterFields" : "questionFields");
            const model = this.model("draft");
            const rows = model.getProperty("/" + section);
            const index = this.selected[section];
            const isChapter = section === "chapters";
            const label = isChapter ? "Kapitel" : "Frage";
            container.destroyItems();
            if (!rows.length) {
                container.addItem(new Title({ text: isChapter ? "Noch keine Kapitel" : "Noch keine Fragen", level: "H3" }));
                return;
            }
            const row = rows[index];
            const path = "/" + section + "/" + index;
            const chooser = new Select({
                selectedKey: String(index),
                items: rows.map((item, number) => new Item({ key: String(number),
                    text: label + " " + (number + 1) + (item.title || item.prompt ? " · " + (item.title || item.prompt).slice(0, 75) : "") })),
                change: (event) => {
                    this.selected[section] = Number(event.getSource().getSelectedKey());
                    this.renderSection(section);
                }
            }).setWidth("100%");
            container.addItem(new VBox({ items: this.field(label + " auswählen", chooser) }).addStyleClass("editorFields"));
            const tools = [
                this.button("Nach oben", () => this.move(section, index - 1), index > 0),
                this.button("Nach unten", () => this.move(section, index + 1), index < rows.length - 1),
                this.button(label + " entfernen", () => this.confirm(label + " aus dem Entwurf entfernen?", () => {
                    model.setProperty("/" + section, rows.filter((_, number) => index !== number));
                    this.selected[section] = Math.max(0, Math.min(index, rows.length - 2));
                    this.renderSection(section);
                }))
            ];
            container.addItem(new FlexBox({ wrap: "Wrap", items: tools }).addStyleClass("trainingTools"));
            const items = isChapter ? this.chapterFields(path, row, section) : this.questionFields(path, row, section);
            items.forEach((item) => container.addItem(item));
        },

        move(section, target) {
            const model = this.model("draft");
            const rows = [...model.getProperty("/" + section)];
            const index = this.selected[section];
            [rows[index], rows[target]] = [rows[target], rows[index]];
            model.setProperty("/" + section, rows);
            this.selected[section] = target;
            this.renderSection(section);
        },

        changeList(section, path, list) {
            this.model("draft").setProperty(path, list);
            this.renderSection(section);
        },

        chapterFields(path, row, section) {
            const heading = new Input({ value: pathBinding(path + "/title"), valueLiveUpdate: true, maxLength: 150 });
            const items = [new VBox({ items: this.field("Kapiteltitel", heading) }).addStyleClass("editorFields")];
            row.blocks.forEach((block, index) => {
                const itemPath = path + "/blocks/" + index;
                const select = new Select({ selectedKey: pathBinding(itemPath + "/type"), width: "100%",
                    items: Object.entries(formatNames).map(([key, text]) => new Item({ key, text })) });
                const area = new TextArea({ value: pathBinding(itemPath + "/text"), valueLiveUpdate: true, rows: 4, width: "100%" });
                const move = (target) => {
                    const blocks = [...row.blocks];
                    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
                    this.changeList(section, path + "/blocks", blocks);
                };
                items.push(new VBox({ items: [
                    new Title({ text: "Inhaltsblock " + (index + 1), level: "H3" }),
                    ...this.field("Format", select), ...this.field("Inhalt", area),
                    new FlexBox({ wrap: "Wrap", items: [
                        this.button("Block nach oben", () => move(index - 1), index > 0),
                        this.button("Block nach unten", () => move(index + 1), index < row.blocks.length - 1),
                        this.button("Block entfernen", () => this.changeList(section, path + "/blocks", row.blocks.filter((_, i) => i !== index)))
                    ] })
                ] }).addStyleClass("editorFields editorBlock"));
            });
            items.push(this.button("Inhaltsblock hinzufügen", () =>
                this.changeList(section, path + "/blocks", [...row.blocks, { type: "paragraph", text: "" }])));
            return items;
        },

        questionFields(path, row, section) {
            const prompt = new TextArea({ value: pathBinding(path + "/prompt"), valueLiveUpdate: true, rows: 2, width: "100%" });
            const select = new Select({ selectedKey: pathBinding(path + "/type"), width: "100%", items: [
                new Item({ key: "single", text: "Single Choice" }), new Item({ key: "multiple", text: "Multiple Choice" })
            ] });
            return [
                new VBox({ items: [...this.field("Fragestellung", prompt), ...this.field("Fragetyp", select)] }).addStyleClass("editorFields"),
                ...row.options.map((option, index) => {
                    const itemPath = path + "/options/" + index;
                    return new VBox({ items: [
                        ...this.field("Antwort " + (index + 1), new Input({ value: pathBinding(itemPath + "/text"), valueLiveUpdate: true, maxLength: 500 })),
                        new CheckBox({ text: "Richtige Antwort", selected: pathBinding(itemPath + "/correct") }),
                        this.button("Antwort entfernen", () => this.changeList(section, path + "/options", row.options.filter((_, i) => i !== index)))
                    ] }).addStyleClass("editorFields editorBlock");
                }),
                this.button("Antwort hinzufügen", () =>
                    this.changeList(section, path + "/options", [...row.options, { text: "", correct: false }]))
            ];
        },

        async persist() {
            const { id, revision } = this.current;
            const saved = await this.training().saveDraft({ id, revision, draft: this.model("draft").getData() });
            Object.assign(this.current, saved);
            return saved;
        },

        onSave() {
            return this.run(async function () {
                const isNew = !this.current.id;
                const { id } = await this.persist();
                if (isNew) {
                    await this.loadCourse(id);
                    this.getOwnerComponent().getRouter().navTo("TrainingEditor", { courseId: id }, true);
                }
                else {
                    const record = await this.training().editor(id);
                    this.model("editor").setProperty("/audit", record.audit.map((row) => ({ ...row, date: this.date(row.at) })));
                }
            }, "Entwurf gespeichert.");
        },

        onPublish() {
            this.confirm("Eine neue unveränderliche Version veröffentlichen?", () => this.run(async function () {
                const { id, revision } = await this.persist();
                await this.training().publish(id, revision);
                await this.loadCourse(id);
                this.getOwnerComponent().getRouter().navTo("TrainingEditor", { courseId: id }, true);
            }, "Version veröffentlicht."));
        },

        onToggleActive() {
            const { id, active, revision } = this.current;
            this.confirm(active ? "Schulung für neue Teilnahme und Zuweisungen deaktivieren?" : "Schulung wieder aktivieren?",
                () => this.run(async function () {
                    await this.training().setActive(id, !active, revision);
                    const current = await this.training().editor(id);
                    Object.assign(this.current, { active: current.active, revision: current.revision });
                    this.model("editor").setProperty("/active", current.active);
                    this.model("editor").setProperty("/audit", current.audit.map((row) => ({ ...row, date: this.date(row.at) })));
                }, active ? "Schulung deaktiviert." : "Schulung aktiviert."));
        }
    });
});
