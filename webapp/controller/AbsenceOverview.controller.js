sap.ui.define(["./BaseController"], function (Base) {
    "use strict";

    return Base.extend("sapselfservice.controller.AbsenceOverview", {
        onInit() {
            this.observe("absenceOverview", async function () {
                this.model("AbwesenceModel", { entries: await this.hr().absenceRows(this.id()) });
            });
        },

        onNewAbsenceRequest() { this.nav("newAbsenceRequest"); }
    });
});
