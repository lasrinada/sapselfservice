sap.ui.define([
    "./BaseController", "sap/m/MessageBox", "sap/m/Dialog", "sap/m/List", "sap/m/StandardListItem", "sap/m/Button"
], function (Base, MessageBox, Dialog, List, StandardListItem, Button) {
    "use strict";

    return Base.extend("sapselfservice.controller.Main", {
        onInit() {
            this.model("home", { reminders: [], privacy: null, privacyProgress: 0 });
            this.observe("Main", async function () {
                const { privacy, reminders } = await this.training().overview();
                this.model("home", { privacy, reminders, privacyProgress: privacy?.progress || 0 });
            });
        },

        onNavigate(event) {
            this.nav(event.getSource().data("route"));
        },

        onPrivacy() { this.nav("Privacy"); },

        onReminder(event) {
            const { id } = event.getSource().getBindingContext("home").getObject();
            this.nav("Learn", { assignmentId: id });
        },

        onNotiPress() {
            return this.run(async function () {
                const rows = await this.hr().absenceRows(this.id(), "decided");
                const list = new List({ noDataText: "Keine neuen Entscheidungen vorhanden." });
                const dialog = new Dialog({ title: "Benachrichtigungen", contentWidth: "30rem", content: list,
                    endButton: new Button({ text: "Schließen", press: () => dialog.close() }),
                    afterClose: () => dialog.destroy() });
                rows.forEach((row) => list.addItem(new StandardListItem({
                    title: row.AbwesenheitsartBeschreibung, description: row.Antragsdatum,
                    info: row.Status, infoState: row.state, type: "Active",
                    press: () => { dialog.close(); this.nav("absenceOverview"); }
                })));
                this.getView().addDependent(dialog);
                dialog.open();
            });
        },

        onLogoutPress() {
            MessageBox.confirm("Möchten Sie sich abmelden?", {
                onClose: (action) => {
                    if (action === MessageBox.Action.OK) this.getOwnerComponent().signOut();
                }
            });
        }
    });
});
