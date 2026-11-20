const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../webapp");
const cache = new Map();

// The local service shares the demo directory, calendar and role rules with UI5.
function load(name) {
    if (cache.has(name)) return cache.get(name);
    const filename = path.join(root, name + ".js");
    const source = fs.readFileSync(filename, "utf8");
    const sap = { ui: { define(dependencies, factory) {
        const resolved = dependencies.map((dependency) => dependency.startsWith(".") ?
            path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency)) :
            dependency.replace(/^sapselfservice\//, ""));
        cache.set(name, factory(...resolved.map(load)));
    } } };
    new Function("sap", source)(sap);
    return cache.get(name);
}

module.exports = load;
