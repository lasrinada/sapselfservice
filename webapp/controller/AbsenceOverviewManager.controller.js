sap.ui.define(["./BaseController", "sap/ui/core/Fragment"], function (Base, Fragment) {
    "use strict";

    return Base.extend("sapselfservice.controller.AbsenceOverviewManager", {
        onInit() {
            this.model("absencesModel", { Absences: [], noDataMessage: "Keine offenen Anträge" });
            this.observe("AbsenceOverviewManager", this.loadRequests);
        },

        async loadRequests() {
            const rows = await this.hr().absenceRows(this.id(), "team");
            this.model("absencesModel").setProperty("/Absences", rows);
        },

        onShowDetails(event) {
            const row = event.getSource().getBindingContext("absencesModel").getObject();
            return this.run(async function () {
                this.model("absencesModel").setProperty("/SelectedAbsence", row);
                if (!this.details) {
                    this.details = await Fragment.load({
                        id: this.getView().getId(), name: "sapselfservice.view.AbsenceDetailsDialog", controller: this
                    });
                    this.getView().addDependent(this.details);
                }
                this.details.open();
            });
        },

        onCloseDetailsDialog() { this.details?.close(); },
        onApproveAbsence(event) { return this.decide(event, true); },
        onRejectAbsence(event) { return this.decide(event, false); },

        decide(event, approved) {
            const row = event.getSource().getBindingContext("absencesModel").getObject();
            return this.run(async function () {
                await this.hr().decideAbsence(this.id(), row.docId, approved);
                await this.loadRequests();
            }, approved ? "Antrag genehmigt." : "Antrag abgelehnt.");
        }
    });
});
