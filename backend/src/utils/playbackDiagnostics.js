const sessions = new Map();
const ttl = 15 * 60_000;
const validId = id => typeof id === 'string' && /^[a-f0-9]{32}$/.test(id);

function record(req, mode, started, cache) {
    const id = req.query.diagnostic;
    if (req.user?.role !== 'admin' || !validId(id)) return;
    const key = req.user.id + ':' + id;
    const now = Date.now();
    const previous = sessions.get(key);
    const counters = previous && now - previous.updated < ttl ? previous.counters : {};
    if (cache) counters[cache] = (counters[cache] || 0) + 1;
    sessions.delete(key);
    sessions.set(key, { mode, counters, milliseconds: Math.round(performance.now() - started), updated: now });
    if (sessions.size > 256) sessions.delete(sessions.keys().next().value);
}

function read(req, res) {
    if (!validId(req.query.diagnostic)) return res.sendStatus(400);
    const entry = sessions.get(req.user.id + ':' + req.query.diagnostic);
    res.json(entry && Date.now() - entry.updated < ttl ? entry : null);
}

module.exports = { record, read };
