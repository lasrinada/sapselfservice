const fs = require("node:fs/promises");
const path = require("node:path");

class FileRepository {
    constructor(file, seed) {
        this.file = file;
        this.seed = seed;
        this.queue = Promise.resolve();
        this.ready = this.load();
    }

    async load() {
        try {
            const state = JSON.parse(await fs.readFile(this.file, "utf8"));
            if (state.schema !== 1) throw new Error("Unbekannte Datenversion der Schulungsdatei.");
            this.state = state;
        } catch (error) {
            if (error.code !== "ENOENT") throw error;
            this.state = this.seed();
            await this.persist(this.state);
        }
    }

    read(select) {
        return this.queue.then(async () => {
            await this.ready;
            return select(structuredClone(this.state));
        });
    }

    transact(change) {
        const operation = this.queue.then(async () => {
            await this.ready;
            const state = structuredClone(this.state);
            const result = change(state);
            if (JSON.stringify(state) !== JSON.stringify(this.state)) {
                await this.persist(state);
                this.state = state;
            }
            return structuredClone(result);
        });
        this.queue = operation.catch(() => {});
        return operation;
    }

    async persist(state) {
        await fs.mkdir(path.dirname(this.file), { recursive: true });
        const temporary = this.file + ".tmp";
        await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
        await fs.rename(temporary, this.file);
    }
}

module.exports = FileRepository;
