sap.ui.define(["sapselfservice/data/DemoData"], function (createDemoData) {
    "use strict";

    const storageKey = "sapselfservice.demo.v1";

    class LocalRepository {
        constructor(storage = window.localStorage) {
            this.storage = storage;
        }

        readState() {
            const saved = this.storage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
            const state = createDemoData();
            this.storage.setItem(storageKey, JSON.stringify(state));
            return state;
        }

        async read(select) {
            return select(this.readState());
        }

        async transact(change) {
            const commit = () => {
                const state = this.readState();
                const original = JSON.stringify(state);
                const result = change(state);
                const updated = JSON.stringify(state);
                if (updated !== original) this.storage.setItem(storageKey, updated);
                return result;
            };
            const locks = globalThis.navigator?.locks;
            return locks ? locks.request(storageKey, commit) : commit();
        }
    }

    return LocalRepository;
});
