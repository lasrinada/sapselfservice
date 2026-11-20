sap.ui.define(["./BaseController", "sap/ui/model/Filter"], function (Base, Filter) {
    "use strict";

    return Base.extend("sapselfservice.controller.EmployeeDirectory", {
        onInit() {
            this.observe("EmployeeDirectory", async function () {
                await this.hr().syncPeople((await this.training().identity()).people);
                this.model("employees", await this.hr().directory(this.id()));
                this.onResetSearch();
            });
        },

        onSearchChanged(event) {
            const query = (event.getParameter("newValue") || event.getParameter("query") || "").trim().toLowerCase();
            const entries = this.model("employees");
            if (!entries) return;
            this.byId("idEmployeeTable").getBinding("items").filter(query.split(/\s+/).filter(Boolean).map((term) =>
                new Filter({ filters: ["Vorname", "Nachname", "role", "Email"].map((path) =>
                    new Filter({ path, test: (value) => (value || "").toLowerCase().includes(term) })), and: false })));
        },

        onResetSearch() {
            this.byId("directorySearch").setValue("");
            this.byId("idEmployeeTable").getBinding("items")?.filter([]);
        },

        formatEmergencyContact(name, phone) {
            return [name, phone].filter(Boolean).join(" · ") || "Kein Notfallkontakt hinterlegt";
        }
    });
});
