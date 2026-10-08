// Lightweight JSON-file datastore. No external database required.
// Collections: users, transactions, budgets, goals. Each persisted to ./data/<name>.json.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const FILES = {
  users: 'users.json',
  transactions: 'transactions.json',
  budgets: 'budgets.json',
  goals: 'goals.json',
};

const collections = { users: [], transactions: [], budgets: [], goals: [] };
let writeQueue = Promise.resolve();

function newId() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function init() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const name of Object.keys(FILES)) {
    const file = path.join(DATA_DIR, FILES[name]);
    if (fs.existsSync(file)) {
      try {
        collections[name] = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (!Array.isArray(collections[name])) collections[name] = [];
      } catch (e) {
        collections[name] = [];
      }
    } else {
      collections[name] = [];
    }
  }
  return Promise.resolve();
}

function scheduleWrite(name) {
  const file = path.join(DATA_DIR, FILES[name]);
  const snapshot = JSON.stringify(collections[name], null, 2);
  writeQueue = writeQueue.then(() => fs.promises.writeFile(file, snapshot));
  return writeQueue;
}

function matches(doc, filter) {
  if (!filter) return true;

  if (filter.$or) {
    if (!filter.$or.some((sub) => matches(doc, sub))) return false;
    const rest = { ...filter };
    delete rest.$or;
    return matches(doc, rest);
  }

  return Object.keys(filter).every((key) => {
    const cond = filter[key];
    if (cond === undefined || cond === null) return doc[key] === cond;
    if (cond instanceof Date) return doc[key] === cond.toISOString();
    if (typeof cond === 'object') {
      for (const op of Object.keys(cond)) {
        const target = doc[key];
        let val = cond[op];
        if (val instanceof Date) val = val.toISOString();
        switch (op) {
          case '$gte':
            if (!(target >= val)) return false;
            break;
          case '$lte':
            if (!(target <= val)) return false;
            break;
          case '$gt':
            if (!(target > val)) return false;
            break;
          case '$lt':
            if (!(target < val)) return false;
            break;
          case '$in':
            if (!val.includes(target)) return false;
            break;
          case '$ne':
            if (target === val) return false;
            break;
          case '$regex':
            if (!new RegExp(val, 'i').test(String(target == null ? '' : target))) return false;
            break;
          default:
            return false;
        }
      }
      return true;
    }
    return doc[key] === cond;
  });
}

function find(name, filter, opts = {}) {
  let items = collections[name].filter((d) => matches(d, filter));
  if (opts.sort) {
    const keys = Object.keys(opts.sort);
    items.sort((a, b) => {
      for (const k of keys) {
        const dir = opts.sort[k];
        if (a[k] < b[k]) return -1 * dir;
        if (a[k] > b[k]) return 1 * dir;
      }
      return 0;
    });
  }
  if (opts.skip) items = items.slice(opts.skip);
  if (opts.limit) items = items.slice(0, opts.limit);
  return items.map((d) => ({ ...d }));
}

function findOne(name, filter) {
  const doc = collections[name].find((d) => matches(d, filter));
  return doc ? { ...doc } : null;
}

function count(name, filter) {
  return collections[name].filter((d) => matches(d, filter)).length;
}

async function insert(name, doc) {
  const full = { _id: newId(), createdAt: now(), updatedAt: now(), ...doc };
  collections[name].push(full);
  await scheduleWrite(name);
  return { ...full };
}

// Persists a mutated document returned by findOne/find.
async function save(name, doc) {
  const idx = collections[name].findIndex((d) => d._id === doc._id);
  if (idx === -1) return null;
  collections[name][idx] = { ...doc, _id: doc._id, createdAt: doc.createdAt, updatedAt: now() };
  await scheduleWrite(name);
  return { ...collections[name][idx] };
}

async function deleteMany(name, filter) {
  const before = collections[name].length;
  collections[name] = collections[name].filter((d) => !matches(d, filter));
  const removed = before - collections[name].length;
  if (removed) await scheduleWrite(name);
  return removed;
}

module.exports = { init, find, findOne, count, insert, save, deleteMany, DATA_DIR, newId };
