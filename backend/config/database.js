const dns = require('dns');
const mongoose = require('mongoose');

require('dotenv').config();

// Helps Atlas `mongodb+srv` resolution on some Windows/network setups (IPv6/DNS ordering).
try {
  dns.setDefaultResultOrder('ipv4first');
} catch {
  /* older Node */
}

// Optional: `querySrv ECONNREFUSED` with some ISP/resolvers — set e.g. MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1
if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(
    process.env.MONGODB_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean)
  );
}

const dbUser = process.env.MONGODB_USER;
const dbPassword = process.env.MONGODB_PASSWORD;
const dbName = process.env.MONGODB_DBNAME || 'tasksdb';
const dbHost = process.env.MONGODB_HOST || 'cluster0.re3ha3x.mongodb.net';

/**
 * Atlas SCRAM users authenticate against `admin`. If authSource is omitted, drivers may use the
 * database name from the path (e.g. /taskmanager), which causes "bad auth : authentication failed".
 */
function ensureAtlasAuthSource(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (!uri.startsWith('mongodb+srv://')) return uri;
  const explicit = process.env.MONGODB_AUTH_SOURCE?.trim();
  if (explicit) {
    if (/[?&]authSource=/i.test(uri)) return uri;
    const sep = uri.includes('?') ? '&' : '?';
    return `${uri}${sep}authSource=${encodeURIComponent(explicit)}`;
  }
  if (/[?&]authSource=/i.test(uri)) return uri;
  const sep = uri.includes('?') ? '&' : '?';
  return `${uri}${sep}authSource=admin`;
}

/**
 * Encode username/password so characters like @ : / # ? % do not break the URI or SCRAM handshake.
 */
function encodeSrvCredentials(uri) {
  if (!uri || typeof uri !== 'string') return uri;
  if (!uri.startsWith('mongodb+srv://')) return uri;
  try {
    const rest = uri.slice('mongodb+srv://'.length);
    const at = rest.lastIndexOf('@');
    if (at === -1) return uri;
    const credHost = rest.slice(0, at);
    const hostQuery = rest.slice(at + 1);
    const colon = credHost.indexOf(':');
    if (colon === -1) return uri;
    let user = credHost.slice(0, colon);
    let pass = credHost.slice(colon + 1);
    try {
      user = decodeURIComponent(user);
    } catch {
      /* already literal */
    }
    try {
      pass = decodeURIComponent(pass);
    } catch {
      /* already literal */
    }
    return `mongodb+srv://${encodeURIComponent(user)}:${encodeURIComponent(pass)}@${hostQuery}`;
  } catch {
    return uri;
  }
}

function buildFallbackAtlasUri() {
  const user = encodeURIComponent(String(dbUser).trim());
  const pass = encodeURIComponent(String(dbPassword).trim());
  let uri = `mongodb+srv://${user}:${pass}@${dbHost}/${dbName}?retryWrites=true&w=majority`;
  uri = ensureAtlasAuthSource(uri);
  return uri;
}

module.exports = async function connectDB() {
  let mongoURI = process.env.MONGODB_URI?.trim();
  if (!mongoURI && dbUser && dbPassword) {
    mongoURI = buildFallbackAtlasUri();
  }

  if (process.env.USE_IN_MEMORY_MONGO === 'true') {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create({
      instance: { dbName },
    });
    mongoURI = mongod.getUri();
    global.__MONGO_MEMORY_SERVER__ = mongod;
    console.warn(
      '[dev] In-memory MongoDB (USE_IN_MEMORY_MONGO=true). Data is not persisted across restarts.'
    );
  }

  if (!mongoURI) {
    throw new Error(
      'Missing MongoDB URI: set MONGODB_URI in .env, or USE_IN_MEMORY_MONGO=true for local dev.'
    );
  }

  if (!process.env.USE_IN_MEMORY_MONGO || process.env.USE_IN_MEMORY_MONGO !== 'true') {
    mongoURI = encodeSrvCredentials(mongoURI);
    mongoURI = ensureAtlasAuthSource(mongoURI);
  }

  try {
    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: 15_000,
      family: 4,
    });
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed');
    console.error(error.message || error);
    if (
      error.code === 8000 ||
      error.codeName === 'AtlasError' ||
      (typeof error.message === 'string' &&
        error.message.includes('bad auth'))
    ) {
      console.error(
        'Atlas auth failed: verify DB username/password in Atlas → Database Users, ' +
          'confirm database name in the URI path, URL-encode special characters in the password, ' +
          'and ensure authSource=admin (added automatically for mongodb+srv when missing).'
      );
    }
    throw error;
  }
};
