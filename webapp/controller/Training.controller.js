sap.ui.define(["./BaseController", "sap/m/MessageBox"], function (Base, MessageBox) {
    "use strict";

    const fulfilled = (row) => ["complete", "expiring"].includes(row.status);

    function metrics(rows, trainings) {
        const count = (status) => rows.filter((row) => row.status === status).length;
        const required = rows.filter((row) => row.mandatory && row.active);
        const done = required.filter(fulfilled).length;
        return {
            total: trainings.length, mandatory: trainings.filter((row) => row.active && row.mandatory).length,
            complete: rows.filter(fulfilled).length, open: count("open") + count("started") + count("dueSoon"),
            overdue: count("overdue"),
            expiring: count("expiring"), expired: count("expired"), required: required.length, done,
            percent: required.length ? Math.round(done / required.length * 100) : 0,
            progress: done + " von " + required.length + " Pflichtzuweisungen erfüllt"
        };
    }

    return Base.extend("sapselfservice.controller.Training", {
        onInit() {
            this.model("training", { tab: "own", status: "", person: "", query: "", metrics: { percent: 0 },
                history: [], assignments: [], people: [], trainings: [] });
            this.model("assign", {});
            this.model("person", {});
            this.model("exams", { query: "" });
            this.observe("Training", this.reload);
        },

        async reload() {
            const overview = await this.training().overview();
            const { tab, status, person, query } = this.model("training").getData();
            this.model("training", {
                ...overview, tab, status, person, query, metrics: { percent: 0 },
                teamPeople: overview.people.filter((row) => row.id !== overview.ownId),
                activeTrainings: overview.trainings.filter((row) => row.active)
            });
            this.filter();
            this.filterHistory();
        },

        filter() {
            const model = this.model("training");
            const data = model.getData();
            const rows = data.assignments.filter((row) => data.tab === "team" ? !row.own : row.own);
            const scoped = rows.filter((row) => !data.person || data.tab !== "team" || row.employeeId === data.person);
            const catalog = data.tab === "team" ? data.trainings :
                data.trainings.filter((item) => rows.some((row) => row.trainingId === item.id));
            const current = scoped.filter((row) => !row.closedOn);
            const query = data.query.trim().toLowerCase();
            model.setProperty("/metrics", metrics(current, catalog));
            model.setProperty("/rows", scoped.filter((row) => (!data.status ? !row.closedOn : row.status === data.status) &&
                (!query || [row.title, row.employee, row.category].some((value) => value.toLowerCase().includes(query)))));
            model.setProperty("/peopleMetrics", data.people.filter((row) => row.id !== data.ownId).map((person) => ({
                ...person, ...metrics(rows.filter((row) => !row.closedOn && row.employeeId === person.id), [])
            })));
        },

        onTab(event) {
            this.model("training").setProperty("/tab", event.getParameter("key"));
            this.filter();
        },

        onFilter() { this.filter(); },

        filterHistory() {
            const query = this.model("exams").getProperty("/query").trim().toLowerCase();
            const rows = this.model("training").getProperty("/history");
            this.model("exams").setProperty("/rows", rows.filter((row) =>
                [row.employee, row.title, row.employeeId].some((value) => value.toLowerCase().includes(query)))
                .map((row) => ({ ...row, dateText: new Date(row.at).toLocaleString("de-DE") })));
        },

        onSearchHistory(event) {
            this.model("exams").setProperty("/query", event.getParameter("newValue"));
            this.filterHistory();
        },

        onSearch(event) {
            this.model("training").setProperty("/query", event.getParameter("newValue"));
            this.filter();
        },

        onClearPerson() {
            this.model("training").setProperty("/person", "");
            this.filter();
        },

        onNew() { this.nav("TrainingEditor", { courseId: "new" }); },

        onEdit(event) {
            const row = event.getSource().getBindingContext("training").getObject();
            this.nav("TrainingEditor", { courseId: row.id });
        },

        onNewEmployee() {
            this.model("person", { departmentId: this.model("training").getProperty("/departments/0/id") });
            this.byId("employeeDialog").open();
        },

        onCloseEmployee() { this.byId("employeeDialog").close(); },

        onSaveEmployee() {
            return this.run(async function () {
                await this.training().createEmployee(this.model("person").getData());
                await this.hr().syncPeople((await this.training().identity()).people);
                this.onCloseEmployee();
                await this.reload();
            }, "Demomitarbeiter angelegt und Pflichtschulungen zugeordnet.");
        },

        onAssign() {
            const data = this.model("training").getData();
            this.openAssign({ mode: "person", trainingId: data.activeTrainings[0]?.id || "",
                targetId: data.people[0]?.id || "", dueOn: this.hr().today(), dueDays: "30" });
        },

        onNewRule() {
            const data = this.model("training").getData();
            this.openAssign({ mode: "group", trainingId: data.activeTrainings.find((row) => row.mandatory)?.id || "",
                targetId: data.departments[0]?.id || "", dueDays: "30" });
        },

        onAssignmentMode(event) {
            const mode = event.getSource().getSelectedKey();
            const data = this.model("training").getData();
            this.model("assign").setProperty("/targetId", (mode === "group" ? data.departments : data.people)[0]?.id || "");
        },

        onRenew(event) {
            const row = event.getSource().getBindingContext("training").getObject();
            this.openAssign({ mode: "person", trainingId: row.trainingId, targetId: row.employeeId,
                renewId: row.id, dueOn: this.hr().today() });
        },

        onEditAssignment(event) {
            const row = event.getSource().getBindingContext("training").getObject();
            this.openAssign({ mode: "person", trainingId: row.trainingId, targetId: row.employeeId,
                editId: row.id, dueOn: row.dueOn });
        },

        openAssign(data) {
            this.model("assign", data);
            this.byId("assignmentDue").setValueState("None");
            this.byId("assignmentDialog").open();
        },

        onCloseAssign() { this.byId("assignmentDialog").close(); },

        onSaveAssignment() {
            return this.run(async function () {
                const form = this.model("assign").getData();
                if (form.mode === "person" && (this.byId("assignmentDue").getValueState() === "Error" ||
                    !this.byId("assignmentDue").getDateValue())) throw new Error("Bitte ein gültiges Datum eingeben.");
                if (form.editId) await this.training().changeDueDate(form.editId, form.dueOn);
                else await this.training().assign(form);
                this.onCloseAssign();
                await this.reload();
            }, "Zuweisung gespeichert.");
        },

        onAssignmentDateChange(event) {
            event.getSource().setValueState(event.getParameter("valid") ? "None" : "Error");
        },

        onRemove(event) { return this.confirm(event, "Offene Zuweisung entfernen?", "removeAssignment", "Zuweisung entfernt."); },
        onRemoveRule(event) { return this.confirm(event, "Gruppenregel aufheben? Vorhandene Zuweisungen bleiben erhalten.", "removeRule", "Regel aufgehoben."); },

        confirm(event, prompt, action, success) {
            const { id } = event.getSource().getBindingContext("training").getObject();
            MessageBox.confirm(prompt, { onClose: (answer) => {
                if (answer === MessageBox.Action.OK) this.run(async function () {
                    await this.training()[action](id);
                    await this.reload();
                }, success);
            } });
        },

        onPrivacy() { this.nav("Privacy"); },

        onLearn(event) {
            const row = event.getSource().getBindingContext("training").getObject();
            this.nav("Learn", { assignmentId: row.id });
        }
    });
});
