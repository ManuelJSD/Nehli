const { createHash, randomBytes } = require('node:crypto');
const { Op } = require('sequelize');
const Link = require('../models/accountLink');

const digest = value => createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

async function issue(kind, fields, lifetime) {
    await Link.destroy({ where: { kind, expiresAt: { [Op.lte]: new Date() } } });
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + lifetime);
    await Link.create({ ...fields, digest: digest(token), kind, expiresAt });
    return { token, expiresAt };
}

async function find(kind, token, transaction) {
    if (!validToken(token)) return null;
    return Link.findOne({
        where: { digest: digest(token), kind, expiresAt: { [Op.gt]: new Date() } },
        ...(transaction ? { transaction, lock: transaction.LOCK.UPDATE } : {})
    });
}

module.exports = { Link, issue, find };
