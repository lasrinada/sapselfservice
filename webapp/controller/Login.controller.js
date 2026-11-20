sap.ui.define(["./BaseController"], function (Base) {
    "use strict";

    return Base.extend("sapselfservice.controller.Login", {
        onInit() {
            this.model("login", { accounts: [], username: "", password: "" });
            this.observe("login", async function () {
                this.model("login", { ...await this.training().options(), username: "", password: "" });
            });
        },

        onDemoSelect(event) {
            this.model("login").setProperty("/username", event.getSource().getSelectedKey());
            this.byId("passwID").focus();
        },

        onLoginpress() {
            return this.run(async function () {
                const model = this.model("login");
                const { username, password } = model.getData();
                const identity = await this.training().login(username, password);
                await this.getOwnerComponent().applyIdentity(identity);
                model.setProperty("/password", "");
                this.getOwnerComponent().getRouter().navTo("Main", {}, true);
            });
        }
    });
});
