sap.ui.define(["./BaseController"], function (Base) {
    "use strict";

    const personal = ["firstNameInput", "lastNameInput", "streetInput", "houseInput", "placeInput", "postcodeInput", "sexSelect"];
    const bank = ["ibanInput", "bicInput"];

    return Base.extend("sapselfservice.controller.Profile", {
        onInit() {
            this.model(undefined, { genders: [
                { key: "männlich", text: "Männlich" }, { key: "weiblich", text: "Weiblich" }, { key: "divers", text: "Divers" }
            ] });
            this.observe("profile", this.reload);
        },

        async reload() {
            this.model("userModel", await this.hr().profile(this.id()));
            this.toggle("PersonalData", personal, false);
            this.toggle("BankData", bank, false);
        },

        toggle(suffix, controls, editing) {
            controls.forEach((id) => this.byId(id).setEnabled(editing));
            this.byId("edit" + suffix).setVisible(!editing);
            this.byId("cancelEdit" + suffix).setVisible(editing);
            this.byId("save" + suffix).setEnabled(editing);
        },

        onEditPersonalData() { this.toggle("PersonalData", personal, true); },
        onEditBankData() { this.toggle("BankData", bank, true); },
        onCancelEditPersonalData() { return this.cancel("PersonalData", personal); },
        onCancelEditBankData() { return this.cancel("BankData", bank); },
        onSavePersonalData() { return this.save("personal", "PersonalData", personal); },
        onSaveBankData() { return this.save("bank", "BankData", bank); },

        cancel(suffix, controls) {
            return this.run(async function () {
                const saved = await this.hr().profile(this.id());
                controls.forEach((id) => {
                    const binding = this.byId(id).getBinding(id === "sexSelect" ? "selectedKey" : "value");
                    this.model("userModel").setProperty(binding.getPath(), saved[binding.getPath().slice(1)]);
                });
                this.toggle(suffix, controls, false);
            });
        },

        save(group, suffix, controls) {
            return this.run(async function () {
                await this.hr().saveProfile(this.id(), group, this.model("userModel").getData());
                const saved = await this.hr().profile(this.id());
                controls.forEach((id) => {
                    const binding = this.byId(id).getBinding(id === "sexSelect" ? "selectedKey" : "value");
                    this.model("userModel").setProperty(binding.getPath(), saved[binding.getPath().slice(1)]);
                });
                this.toggle(suffix, controls, false);
                await this.getOwnerComponent().setSession(this.id());
            }, "Änderungen gespeichert.");
        }
    });
});
