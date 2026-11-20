const path = require("node:path");
const { randomBytes } = require("node:crypto");
const FileRepository = require("./FileRepository.cjs");
const createState = require("./createState.cjs");
const TrainingService = require("./training/TrainingService.cjs");
const { RuleError } = require("./training/rules.cjs");

const operations = {
    identity: (service, actor) => service.identity(actor),
    overview: (service, actor) => service.overview(actor),
    createEmployee: (service, actor, payload) => service.createEmployee(actor, payload),
    editor: (service, actor, payload) => service.editor(actor, payload.courseId),
    saveDraft: (service, actor, payload) => service.saveDraft(actor, payload),
    publish: (service, actor, payload) => service.publish(actor, payload),
    setActive: (service, actor, payload) => service.setActive(actor, payload),
    assign: (service, actor, payload) => service.assign(actor, payload),
    changeDueDate: (service, actor, payload) => service.updateDue(actor, payload),
    removeAssignment: (service, actor, payload) => service.removeAssignment(actor, payload.assignmentId),
    removeRule: (service, actor, payload) => service.removeRule(actor, payload.ruleId),
    learning: (service, actor, payload) => service.learning(actor, payload),
    acknowledge: (service, actor, payload) => service.acknowledge(actor, payload),
    submit: (service, actor, payload) => service.submit(actor, payload)
};

async function body(request) {
    if (!request.headers["content-type"]?.startsWith("application/json")) {
        throw new RuleError("Bitte JSON senden.", 415);
    }
    let value = request.body;
    if (value === undefined) {
        const chunks = [];
        let size = 0;
        for await (const chunk of request) {
            size += chunk.length;
            if (size > 1024 * 1024) throw new RuleError("Die Anfrage überschreitet 1 MiB.", 413);
            chunks.push(chunk);
        }
        value = Buffer.concat(chunks).toString("utf8");
    }
    const serialized = typeof value === "string" ? value : JSON.stringify(value);
    if (Buffer.byteLength(serialized) > 1024 * 1024) throw new RuleError("Die Anfrage überschreitet 1 MiB.", 413);
    try {
        const result = typeof value === "string" ? JSON.parse(value) : value;
        if (!result || typeof result !== "object" || Array.isArray(result)) throw new Error();
        return result;
    } catch {
        throw new RuleError("Ungültige JSON-Anfrage.");
    }
}

function json(response, status, data) {
    response.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
    response.end(JSON.stringify(data));
}

function createMiddleware(service, log = console, sessions = new Map()) {
    const prefix = "/api/training/";
    return async (request, response, next) => {
        const pathname = request.url.split("?")[0];
        if (!pathname.startsWith(prefix)) return next();
        const action = pathname.slice(prefix.length);
        try {
            if (request.method !== "POST") throw new RuleError("Methode nicht unterstützt.", 405);
            if (action === "options") return json(response, 200, { data: await service.options() });
            const payload = await body(request);
            if (action === "login") {
                const id = await service.authenticate(payload);
                const identity = await service.identity(id);
                const token = randomBytes(32).toString("base64url");
                const now = Date.now();
                if (sessions instanceof Map) {
                    for (const [key, session] of sessions) if (session.until < now) sessions.delete(key);
                }
                await sessions.set(token, { id, until: now + 8 * 60 * 60 * 1000 });
                return json(response, 200, { data: { ...identity, token } });
            }
            const operation = Object.hasOwn(operations, action) && operations[action];
            if (!operation && action !== "logout") throw new RuleError("Unbekannte Aktion.", 404);
            const token = request.headers.authorization?.match(/^Bearer ([A-Za-z\d_-]+)$/)?.[1];
            const session = await sessions.get(token);
            if (!session || session.until < Date.now()) throw new RuleError("Die Sitzung ist abgelaufen. Bitte erneut anmelden.", 401);
            if (action === "logout") {
                await sessions.delete(token);
                return json(response, 200, { data: null });
            }
            return json(response, 200, { data: await operation(service, session.id, payload) ?? null });
        } catch (error) {
            if (error instanceof RuleError) return json(response, error.status, { error: error.message });
            log.error(error.stack || String(error));
            return json(response, 500, { error: "Der lokale Schulungsdienst konnte die Anfrage nicht verarbeiten." });
        }
    };
}

module.exports = ({ log } = {}) => {
    const clock = () => new Date();
    const file = process.env.PORTAL_TRAINING_STATE || path.resolve(__dirname, "../.local/training.json");
    const repository = new FileRepository(file, () => createState(clock));
    repository.ready.catch((error) => (log || console).error(error.message));
    return createMiddleware(new TrainingService(repository, clock), log);
};

module.exports.createMiddleware = createMiddleware;
