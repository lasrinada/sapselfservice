sap.ui.define([], function () {
    "use strict";

    const key = "sapselfservice.trainingToken";

    class TrainingApi {
        async call(action, data = {}) {
            const token = window.sessionStorage.getItem(key);
            const response = await fetch("api/training/" + action, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
                body: JSON.stringify(data)
            });
            if (!response.headers.get("content-type")?.includes("application/json")) {
                throw new Error("Der lokale Schulungsdienst ist nicht erreichbar. Bitte die Anwendung mit npm start öffnen.");
            }
            const payload = await response.json();
            if (!response.ok) {
                const error = new Error(payload.error || "Der Schulungsdienst antwortet mit einem Fehler.");
                error.status = response.status;
                throw error;
            }
            return payload.data;
        }

        options() { return this.call("options"); }
        identity() { return this.call("identity"); }
        hasToken() { return Boolean(window.sessionStorage.getItem(key)); }
        clear() { window.sessionStorage.removeItem(key); }

        async login(username, password) {
            const { token, ...identity } = await this.call("login", { username, password });
            window.sessionStorage.setItem(key, token);
            return identity;
        }

        async logout() {
            try { if (this.hasToken()) await this.call("logout"); }
            finally { this.clear(); }
        }

        overview() { return this.call("overview"); }
        editor(courseId) { return this.call("editor", { courseId }); }
        saveDraft(data) { return this.call("saveDraft", data); }
        publish(courseId, revision) { return this.call("publish", { courseId, revision }); }
        setActive(courseId, active, revision) { return this.call("setActive", { courseId, active, revision }); }
        createEmployee(data) { return this.call("createEmployee", data); }
        assign(form) { return this.call("assign", form); }
        changeDueDate(assignmentId, dueOn) { return this.call("changeDueDate", { assignmentId, dueOn }); }
        removeAssignment(assignmentId) { return this.call("removeAssignment", { assignmentId }); }
        removeRule(ruleId) { return this.call("removeRule", { ruleId }); }
        learning(assignmentId, start = false) { return this.call("learning", { assignmentId, start }); }
        acknowledge(assignmentId, version, chapter) { return this.call("acknowledge", { assignmentId, version, chapter }); }
        submit(assignmentId, version, answers) { return this.call("submit", { assignmentId, version, answers }); }
    }

    return TrainingApi;
});
