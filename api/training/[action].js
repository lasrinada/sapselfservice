const { Pool } = require("pg");
const PostgresStore = require("../../server/PostgresStore.cjs");
const createState = require("../../server/createState.cjs");
const TrainingService = require("../../server/training/TrainingService.cjs");
const { createMiddleware } = require("../../server/middleware.cjs");

let middleware;

module.exports = function handler(request, response) {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!connectionString) {
        response.writeHead(503, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store"
        });
        return response.end(JSON.stringify({ error: "Der Schulungsdienst hat noch keine Datenbankverbindung." }));
    }
    if (!middleware) {
        const namespace = process.env.PORTAL_DATA_NAMESPACE ||
            (process.env.VERCEL_ENV === "production" ? "sapselfservice-production" : "sapselfservice-preview");
        const repository = new PostgresStore(new Pool({ connectionString, max: 3,
            connectionTimeoutMillis: 5000, allowExitOnIdle: true }), namespace, () => createState(() => new Date()));
        middleware = createMiddleware(new TrainingService(repository), console, repository);
    }
    return middleware(request, response, () => {
        response.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ error: "Schulungsroute nicht gefunden." }));
    });
};
