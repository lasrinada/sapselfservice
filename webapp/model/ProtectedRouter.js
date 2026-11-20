sap.ui.define(["sap/m/routing/Router"], function (Router) {
    "use strict";

    return Router.extend("sapselfservice.model.ProtectedRouter", {
        constructor: function (routes, config, owner, targets, hashChanger) {
            Router.call(this, routes, config, owner, targets, hashChanger);
            this.component = owner;
        },

        parse(hash) {
            const route = this.getRouteInfoByHash(hash)?.name;
            const target = this.component.routeRedirect(route);
            if (target) this.navTo(target, {}, true);
            else Router.prototype.parse.call(this, hash);
        }
    });
});
