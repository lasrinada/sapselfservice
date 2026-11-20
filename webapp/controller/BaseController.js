sap.ui.define([
    "sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/MessageBox", "sap/m/MessageToast"
], function (Controller, JSONModel, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("sapselfservice.controller.BaseController", {
        model(name, data) {
            const existing = this.getView().getModel(name);
            if (arguments.length < 2) return existing;
            if (this._viewModels?.has(name)) {
                existing.setData(data);
                return existing;
            }
            const model = new JSONModel(data);
            model.setSizeLimit(100000);
            this.getView().setModel(model, name);
            (this._viewModels ||= new Set()).add(name);
            return model;
        },

        observe(route, action) {
            const instance = this.getOwnerComponent().getRouter().getRoute(route);
            this._route = instance;
            this._routeHandler = (event) => this.run(() => action.call(this, event));
            instance.attachPatternMatched(this._routeHandler);
        },

        onExit() {
            this._route?.detachPatternMatched(this._routeHandler);
        },

        hr() { return this.getOwnerComponent().hr; },
        training() { return this.getOwnerComponent().training; },
        id() { return this.getOwnerComponent().getSessionId(); },

        nav(route, args) {
            this.getOwnerComponent().getRouter().navTo(route, args);
        },

        onNavBack() { this.nav("Main"); },

        async run(action, success) {
            if (this._working) return;
            this._working = true;
            this.getView().setBusy(true);
            try {
                const result = await action.call(this);
                if (success) MessageToast.show(success);
                return result;
            } catch (error) {
                if (error.status === 401 && this.id()) this.getOwnerComponent().expireSession();
                else MessageBox.error(error.message || "Die Aktion konnte nicht ausgeführt werden.");
            } finally {
                this._working = false;
                if (!this.getView().isDestroyed()) this.getView().setBusy(false);
            }
        }
    });
});
