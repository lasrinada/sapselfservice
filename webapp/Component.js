sap.ui.define([
    "sap/ui/core/UIComponent", "sap/ui/model/json/JSONModel", "sap/m/MessageBox",
    "sapselfservice/model/models", "sapselfservice/data/LocalRepository",
    "sapselfservice/service/HrService", "sapselfservice/service/TrainingApi", "sapselfservice/model/ProtectedRouter"
], function (UIComponent, JSONModel, MessageBox, models, LocalRepository, HrService, TrainingApi) {
    "use strict";

    const permission = {
        absenceOverview: "selfService", newAbsenceRequest: "selfService", TimeTracking: "selfService",
        AbsenceOverviewManager: "approveAbsences", TrainingEditor: "authorTrainings"
    };

    return UIComponent.extend("sapselfservice.Component", {
        metadata: { manifest: "json" },

        init() {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");
            this.setModel(new JSONModel({}), "session");
            this.hr = new HrService(new LocalRepository());
            this.training = new TrainingApi();
            this.restoreSession();
        },

        async restoreSession() {
            try {
                if (this.training.hasToken()) await this.applyIdentity(await this.training.identity());
            } catch (error) {
                this.training.clear();
                if (error.status !== 401) MessageBox.error("Die lokale Sitzung konnte nicht geladen werden.");
            }
            this.getRouter().initialize();
        },

        getSessionId() {
            return this.getModel("session").getProperty("/id");
        },

        async setSession(id) {
            const session = await this.hr.session(id);
            this.getModel("session").setData(session || {});
        },

        async applyIdentity(identity) {
            await this.hr.syncPeople(identity.people);
            await this.setSession(identity.id);
        },

        expireSession() {
            this.training.clear();
            this.getModel("session").setData({});
            this.getRouter().navTo("login", {}, true);
            window.location.reload();
        },

        async signOut() {
            try { await this.training.logout(); }
            finally { this.expireSession(); }
        },

        routeRedirect(route) {
            if (!this.getSessionId()) return route === "login" ? null : "login";
            if (route === "login" || !route) return "Main";
            const required = permission[route];
            if (required && !this.getModel("session").getProperty("/permissions/" + required)) return "Main";
            return null;
        }
    });
});
