sap.ui.define(["../BaseController"], function (Base) {
    "use strict";

    return Base.extend("sapselfservice.controller.Learning.Privacy", {
        onInit() {
            this.model("privacy", { loading: true });
            this.routes = ["Privacy", "Modules", "Module1", "Module2", "Module3", "Module4",
                "Module5", "Module6", "Quiz", "FailurePage"].map((name) => {
                const route = this.getOwnerComponent().getRouter().getRoute(name);
                route.attachPatternMatched(this.onMatch, this);
                return route;
            });
        },

        onMatch(event) {
            return this.run(async function () {
                this.model("privacy").setProperty("/loading", true);
                const route = event.getParameter("name");
                const { privacy } = await this.training().overview();
                if (privacy?.canLearn) {
                    const index = /^Module([1-6])$/.exec(route);
                    const step = index ? String(Number(index[1]) - 1) :
                        route === "Quiz" ? "quiz" : route === "FailurePage" ? "overview" : undefined;
                    this.getOwnerComponent().getRouter().navTo("Learn", { assignmentId: privacy.id, step }, true);
                } else this.model("privacy").setProperty("/loading", false);
            });
        },

        onNavBack() { this.nav("Training"); },
        onExit() { this.routes.forEach((route) => route.detachPatternMatched(this.onMatch, this)); }
    });
});
