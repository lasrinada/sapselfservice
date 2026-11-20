sap.ui.define(["./BaseController", "sapselfservice/domain/Calendar", "sap/m/MessageBox"],
    function (Base, Calendar, MessageBox) {
    "use strict";

    return Base.extend("sapselfservice.controller.FamilyMembers", {
        onInit() { this.observe("FamilyMembers", this.reload); },

        async reload() {
            this.model(undefined, { ...await this.hr().family(this.id()), isEditingEmergencyContact: false });
        },

        onAddFamilyMember() {
            this.byId("nameInput").setValue("");
            this.byId("birthDatePicker").setValue("");
            this.byId("relationshipSelect").setSelectedKey("");
            this.byId("addFamilyDialog").open();
        },

        onCancelAddFamilyMember() { this.byId("addFamilyDialog").close(); },

        onConfirmAddFamilyMember() {
            return this.run(async function () {
                await this.hr().saveFamilyMember(this.id(), {
                    Name: this.byId("nameInput").getValue(),
                    Beziehung: this.byId("relationshipSelect").getSelectedKey(),
                    Geburtsdatum: Calendar.key(this.byId("birthDatePicker").getDateValue())
                });
                this.model().setProperty("/familyMembers", (await this.hr().family(this.id())).familyMembers);
                this.onCancelAddFamilyMember();
            }, "Familienmitglied hinzugefügt.");
        },

        onDeleteFamilyMember(event) {
            const row = event.getSource().getBindingContext().getObject();
            MessageBox.confirm(row.Name + " aus der Liste entfernen?", { onClose: (action) => {
                if (action === MessageBox.Action.OK) this.run(async function () {
                    await this.hr().removeFamilyMember(this.id(), row.id);
                    this.model().setProperty("/familyMembers", (await this.hr().family(this.id())).familyMembers);
                }, "Familienmitglied entfernt.");
            } });
        },

        onToggleEditEmergencyContact() {
            const model = this.model();
            const editing = model.getProperty("/isEditingEmergencyContact");
            if (editing) model.setProperty("/emergencyContact", this._originalContact);
            else this._originalContact = { ...model.getProperty("/emergencyContact") };
            model.setProperty("/isEditingEmergencyContact", !editing);
        },

        onSaveEmergencyContact() {
            return this.run(async function () {
                await this.hr().saveContact(this.id(), this.model().getProperty("/emergencyContact"));
                await this.reload();
            }, "Notfallkontakt gespeichert.");
        }
    });
});
