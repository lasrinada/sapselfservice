sap.ui.define(["./BaseController", "sapselfservice/domain/Calendar"], function (Base, Calendar) {
    "use strict";

    const fields = ["datepicker", "Zeitraum", "beginnTimePicker", "endTimePicker", "durationTagInput",
        "durationInput", "noteTextArea"];

    return Base.extend("sapselfservice.controller.NewAbsenceRequest", {
        onInit() {
            this.model(undefined, { selectedRadioButton: "moreThanOneDay", Abwesenheitsart: [] });
            this.observe("newAbsenceRequest", async function () {
                const form = await this.hr().absenceForm(this.id());
                this.model().setProperty("/Abwesenheitsart", form.Abwesenheitsart);
                this.byId("absenceTypeSelect").setSelectedKey(form.Abwesenheitsart[0]["Abwesenheit-ID"]);
                this.byId("approverInput").setValue(form.approver);
                this.byId("urlaubkontingent").setText(String(form.quota));
                this.onAbsenceTypeChange();
            });
        },

        onAbsenceTypeChange() {
            const vacation = this.byId("absenceTypeSelect").getSelectedKey() === "vacation";
            const group = this.byId("radiobuttonsgroup");
            group.getButtons()[0].setEnabled(vacation);
            group.setSelectedIndex(vacation ? 0 : 1);
            this.byId("quotaLabel").setVisible(vacation);
            this.byId("urlaubkontingent").setVisible(vacation);
            this.switchRange(vacation);
        },

        onradioButtonChange(event) { this.switchRange(event.getParameter("selectedIndex") === 0); },

        switchRange(range) {
            this.model().setProperty("/selectedRadioButton", range ? "moreThanOneDay" : "oneDayOrLess");
            fields.forEach((id) => {
                this.byId(id).setValue("");
                this.byId(id).setValueState?.("None");
            });
        },

        onDateChange(event) {
            const picker = event.getSource();
            const valid = event.getParameter("valid");
            picker.setValueState(valid ? "None" : "Error");
            const isRange = picker === this.byId("Zeitraum");
            const from = Calendar.key(picker.getDateValue());
            const to = isRange ? Calendar.key(picker.getSecondDateValue()) : from;
            if (isRange) this.byId("durationTagInput").setValue(valid && from && to ? Calendar.weekdays(from, to) : "");
            if (valid && from && this.byId("absenceTypeSelect").getSelectedKey() === "vacation") {
                return this.run(async function () {
                    const form = await this.hr().absenceForm(this.id(), from);
                    this.byId("urlaubkontingent").setText(String(form.quota));
                });
            }
        },

        onTimeChange() {
            const start = Calendar.minutes(this.byId("beginnTimePicker").getValue());
            const end = Calendar.minutes(this.byId("endTimePicker").getValue());
            this.byId("durationInput").setValue(end > start ? ((end - start) / 60).toFixed(2) : "");
        },

        onSaveRequest() {
            const range = this.model().getProperty("/selectedRadioButton") === "moreThanOneDay";
            const first = this.byId(range ? "Zeitraum" : "datepicker");
            const from = Calendar.key(first.getDateValue());
            return this.run(async function () {
                if (first.getValueState() === "Error") throw new Error("Bitte ein gültiges Datum eingeben.");
                await this.hr().requestAbsence(this.id(), {
                    typeId: this.byId("absenceTypeSelect").getSelectedKey(), range, from,
                    to: range ? Calendar.key(first.getSecondDateValue()) : from,
                    start: this.byId("beginnTimePicker").getValue(), end: this.byId("endTimePicker").getValue(),
                    note: this.byId("noteTextArea").getValue()
                });
                this.nav("absenceOverview");
            }, "Antrag eingereicht.");
        },

        onCancelRequest() { this.nav("absenceOverview"); }
    });
});
