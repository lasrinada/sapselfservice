const { createHash } = require("node:crypto");

const tokenHash = (token) => createHash("sha256").update(token).digest("hex");

class PostgresStore {
    constructor(pool, namespace, seed) {
        this.pool = pool;
        this.namespace = namespace;
        this.seed = seed;
        this.ready = null;
    }

    async transaction(action) {
        const client = await this.pool.connect();
        try {
            await client.query("BEGIN");
            const result = await action(client);
            await client.query("COMMIT");
            return result;
        } catch (error) {
            try { await client.query("ROLLBACK"); } catch { /* Preserve the original failure. */ }
            throw error;
        } finally {
            client.release();
        }
    }

    initialize() {
        if (!this.ready) {
            this.ready = this.transaction(async (client) => {
                // Serialize bootstrap across deployments sharing a database.
                await client.query("SELECT pg_advisory_xact_lock(31050133)");
                await client.query(`
                    CREATE TABLE IF NOT EXISTS sapselfservice_state (
                        namespace text PRIMARY KEY,
                        snapshot jsonb NOT NULL
                    );
                    CREATE TABLE IF NOT EXISTS sapselfservice_session (
                        namespace text NOT NULL,
                        token_hash text NOT NULL,
                        employee_id text NOT NULL,
                        expires_at timestamptz NOT NULL,
                        PRIMARY KEY (namespace, token_hash)
                    );
                `);
                await client.query(`
                    INSERT INTO sapselfservice_state (namespace, snapshot)
                    VALUES ($1, $2)
                    ON CONFLICT (namespace) DO NOTHING
                `, [this.namespace, this.seed()]);
            }).catch((error) => {
                this.ready = null;
                throw error;
            });
        }
        return this.ready;
    }

    async read(select) {
        await this.initialize();
        const { rows } = await this.pool.query(
            "SELECT snapshot FROM sapselfservice_state WHERE namespace = $1", [this.namespace]);
        return select(rows[0].snapshot);
    }

    async transact(change) {
        await this.initialize();
        return this.transaction(async (client) => {
            const { rows } = await client.query(
                "SELECT snapshot FROM sapselfservice_state WHERE namespace = $1 FOR UPDATE", [this.namespace]);
            const state = rows[0].snapshot;
            const previous = JSON.stringify(state);
            const result = change(state);
            const current = JSON.stringify(state);
            if (current !== previous) {
                await client.query("UPDATE sapselfservice_state SET snapshot = $2 WHERE namespace = $1",
                    [this.namespace, current]);
            }
            return result;
        });
    }

    async set(token, session) {
        await this.initialize();
        await this.transaction(async (client) => {
            await client.query("DELETE FROM sapselfservice_session WHERE namespace = $1 AND expires_at <= now()",
                [this.namespace]);
            await client.query(`
                INSERT INTO sapselfservice_session (namespace, token_hash, employee_id, expires_at)
                VALUES ($1, $2, $3, $4)
            `, [this.namespace, tokenHash(token), session.id, new Date(session.until)]);
        });
    }

    async get(token) {
        if (!token) return undefined;
        await this.initialize();
        const { rows } = await this.pool.query(`
            SELECT employee_id, expires_at
            FROM sapselfservice_session
            WHERE namespace = $1 AND token_hash = $2 AND expires_at > now()
        `, [this.namespace, tokenHash(token)]);
        return rows[0] && { id: rows[0].employee_id, until: rows[0].expires_at.getTime() };
    }

    async delete(token) {
        await this.initialize();
        await this.pool.query("DELETE FROM sapselfservice_session WHERE namespace = $1 AND token_hash = $2",
            [this.namespace, tokenHash(token)]);
    }
}

module.exports = PostgresStore;
