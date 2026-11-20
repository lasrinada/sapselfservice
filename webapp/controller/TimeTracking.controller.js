sap.ui.define(["./BaseController", "sapselfservice/domain/Calendar", "sapselfservice/domain/HrRules"],
    function (Base, Calendar, Rules) {
    "use strict";

    return Base.extend("sapselfservice.controller.TimeTracking", {
        onInit() {
            this.model("timeTracking", { entries: [] });
            this.model("ZeiterfassungModel", { entries: [] });
            this.observe("TimeTracking", async function () {
                if (!this.byId("monthyearPicker").getValue()) {
                    this.byId("monthyearPicker").setDateValue(Calendar.parse(this.hr().today()));
                }
                await this.loadMonth();
            });
        },

        async loadMonth() {
            const picker = this.byId("monthyearPicker");
            const month = Calendar.key(picker.getDateValue()).slice(0, 7);
            const entries = await this.hr().timeEntries(this.id(), month);
            this.model("ZeiterfassungModel").setProperty("/entries", entries);
        },

        onAnzeigenPress() { return this.run(this.loadMonth); },

        onAddRow() {
            const model = this.model("timeTracking");
            model.setProperty("/entries", [...model.getProperty("/entries"), {
                selected: false, date: this.hr().today(), session1Start: "", session1End: "",
                session2Start: "", session2End: "", stunden: "", pause: ""
            }]);
        },

        onDeleteRow() {
            const model = this.model("timeTracking");
            model.setProperty("/entries", model.getProperty("/entries").filter((row) => !row.selected));
        },

        onCancelTimeTracking() {
            this.model("timeTracking").setProperty("/entries", []);
            this.onNavBack();
        },

        onValidateTime(event) {
            const context = event.getSource().getBindingContext("timeTracking");
            const model = context.getModel();
            let hours = "";
            let pause = "";
            try {
                const duration = Rules.duration(context.getObject());
                hours = duration.hours.toFixed(2) + " h";
                pause = duration.pause.toFixed(2) + " h";
            } catch {
                // Partial input is normal while a row is being edited.
            }
            model.setProperty(context.getPath() + "/stunden", hours);
            model.setProperty(context.getPath() + "/pause", pause);
        },

        onSaveTimeTracking() {
            return this.run(async function () {
                const model = this.model("timeTracking");
                const rows = this.byId("timeTrackingTable").getItems();
                if (rows.some((row) => {
                    const cells = row.getCells();
                    const times = cells[2].getItems().flatMap((box) => box.getItems()).filter((item) => item.isA("sap.m.TimePicker"));
                    return [cells[1], ...times].some((picker) => picker.getValueState() === "Error" ||
                        (picker.getValue() && !picker.getDateValue()));
                })) throw new Error("Bitte Datum und Arbeitszeiten in allen Einträgen prüfen.");
                const entries = model.getProperty("/entries");
                await this.hr().saveTimeEntries(this.id(), entries);
                model.setProperty("/entries", []);
                this.byId("monthyearPicker").setDateValue(Calendar.parse(entries[0].date));
                await this.loadMonth();
                this.byId("timeTrackingTabBar").setSelectedKey("show");
            }, "Zeiterfassung gespeichert.");
        }
    });
});
