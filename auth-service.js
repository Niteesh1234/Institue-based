import { createHash, createHmac, randomBytes, randomInt, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { MongoClient } from 'mongodb';

const scrypt = promisify(scryptCallback);
const databaseName = 'Testing';
const sessionCookieName = 'vijetha_session';
const otpLifetimeMs = 10 * 60 * 1000;
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;
const loginWindowMs = 15 * 60 * 1000;
const passwordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{10,128}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const nativeOrigins = new Set(['https://localhost', 'capacitor://localhost']);
let client;
let database;
let indexPromise;

export class AuthError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function authConfiguration() {
  return {
    database: Boolean(process.env.MONGODB_URI),
    email: Boolean(process.env.RESEND_API_KEY && process.env.AUTH_EMAIL_FROM),
    secret: Boolean(process.env.AUTH_SECRET && process.env.AUTH_SECRET.length >= 32)
  };
}

function requireConfiguration({ email = false } = {}) {
  const configuration = authConfiguration();
  if (!configuration.database || !configuration.secret || (email && !configuration.email)) {
    throw new AuthError(503, 'AUTH_CONFIGURATION_REQUIRED', 'Secure login is being configured. Please try again later.');
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(email) {
  if (!emailPattern.test(email) || email.length > 254) throw new AuthError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
}

function validateName(name) {
  if (name.length < 2 || name.length > 80) throw new AuthError(400, 'INVALID_NAME', 'Enter your full name.');
}

export function validatePassword(password) {
  if (!passwordPattern.test(String(password || ''))) {
    throw new AuthError(400, 'WEAK_PASSWORD', 'Use at least 10 characters with uppercase, lowercase, and a number.');
  }
}

async function ensureIndexes(db) {
  if (!indexPromise) {
    indexPromise = Promise.all([
      db.collection('auth_users').createIndex({ email: 1 }, { unique: true }),
      db.collection('auth_otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('auth_otps').createIndex({ email: 1, purpose: 1, createdAt: -1 }),
      db.collection('auth_sessions').createIndex({ tokenHash: 1 }, { unique: true }),
      db.collection('auth_sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      db.collection('auth_attempts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    ]).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }
  await indexPromise;
}

export async function getTestingDatabase() {
  requireConfiguration();
  if (!client) client = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 10, serverSelectionTimeoutMS: 7000 });
  if (!database) {
    await client.connect();
    database = client.db(databaseName);
    await ensureIndexes(database);
  }
  return database;
}

export async function hashPassword(password, salt = randomBytes(16)) {
  validatePassword(password);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('base64url')}$${Buffer.from(derived).toString('base64url')}`;
}

export async function verifyPassword(password, encodedHash) {
  try {
    const [algorithm, cost, blockSize, parallelization, encodedSalt, encodedDerived] = String(encodedHash || '').split('$');
    if (algorithm !== 'scrypt') return false;
    const expected = Buffer.from(encodedDerived, 'base64url');
    const derived = await scrypt(String(password || ''), Buffer.from(encodedSalt, 'base64url'), expected.length, {
      N: Number(cost), r: Number(blockSize), p: Number(parallelization), maxmem: 64 * 1024 * 1024
    });
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

function hashToken(value) {
  return createHash('sha256').update(value).digest('base64url');
}

export function hashOtp(email, purpose, code, secret = process.env.AUTH_SECRET || '') {
  return createHmac('sha256', secret).update(`${normalizeEmail(email)}:${purpose}:${String(code)}`).digest('base64url');
}

function safeUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role || 'administrator',
    emailVerified: Boolean(user.emailVerifiedAt)
  };
}

function parseCookies(request) {
  return Object.fromEntries(String(request.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const separator = part.indexOf('=');
    return separator === -1 ? [part, ''] : [part.slice(0, separator), decodeURIComponent(part.slice(separator + 1))];
  }));
}

export function isNativeClient(request) {
  return new Set(['android', 'ios']).has(
    String(request.headers['x-vijetha-platform'] || '').toLowerCase()
  );
}

function bearerToken(request) {
  const authorization = String(request.headers.authorization || '');
  return authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
}

function requestSessionToken(request) {
  return bearerToken(request) || parseCookies(request)[sessionCookieName] || '';
}

export function applyNativeCors(request, response) {
  const origin = String(request.headers.origin || '');
  if (!nativeOrigins.has(origin)) return false;
  response.setHeader('Access-Control-Allow-Origin', origin);
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-Vijetha-Platform');
  response.setHeader('Access-Control-Max-Age', '86400');
  response.setHeader('Vary', 'Origin');
  if (request.method !== 'OPTIONS') return false;
  response.status(204).end();
  return true;
}

export function sessionCookie(token, maxAgeSeconds = Math.floor(sessionLifetimeMs / 1000)) {
  const secure = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure ? '; Secure' : ''}`;
}

export function clearSessionCookie() {
  return sessionCookie('', 0);
}

function clientAddress(request) {
  return String(request.headers['x-forwarded-for'] || request.socket?.remoteAddress || 'unknown').split(',')[0].trim().slice(0, 80);
}

export function assertSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  if (isNativeClient(request) && nativeOrigins.has(origin)) return;
  const expectedOrigin = process.env.AUTH_ALLOWED_ORIGIN;
  const host = String(request.headers['x-forwarded-host'] || request.headers.host || '');
  let originHost = '';
  let originHostname = '';
  try {
    const parsedOrigin = new URL(origin);
    originHost = parsedOrigin.host;
    originHostname = parsedOrigin.hostname;
  } catch { throw new AuthError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.'); }
  const requestHostname = host.split(':')[0];
  const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
  if (process.env.NODE_ENV !== 'production' && loopbackHosts.has(originHostname) && loopbackHosts.has(requestHostname)) return;
  if (originHost !== host && origin !== expectedOrigin) throw new AuthError(403, 'INVALID_ORIGIN', 'The request origin is not allowed.');
}

export async function readJsonBody(request) {
  if (request.body && typeof request.body === 'object') return request.body;
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body); } catch { throw new AuthError(400, 'INVALID_JSON', 'The request body is invalid.'); }
  }
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 32768) throw new AuthError(413, 'BODY_TOO_LARGE', 'The request body is too large.');
  }
  try { return body ? JSON.parse(body) : {}; } catch { throw new AuthError(400, 'INVALID_JSON', 'The request body is invalid.'); }
}

async function ensureLoginAllowed(db, email, request) {
  const key = hashToken(`login:${email}:${clientAddress(request)}`);
  const attempt = await db.collection('auth_attempts').findOne({ _id: key });
  if (attempt?.blockedUntil && attempt.blockedUntil > new Date()) throw new AuthError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts. Try again in 15 minutes.');
  return key;
}

async function recordLoginFailure(db, key) {
  const now = new Date();
  const attempt = await db.collection('auth_attempts').findOne({ _id: key });
  const withinWindow = attempt?.windowStartedAt && now.getTime() - attempt.windowStartedAt.getTime() < loginWindowMs;
  const count = withinWindow ? (attempt.count || 0) + 1 : 1;
  await db.collection('auth_attempts').updateOne({ _id: key }, { $set: {
    count,
    windowStartedAt: withinWindow ? attempt.windowStartedAt : now,
    blockedUntil: count >= 8 ? new Date(now.getTime() + loginWindowMs) : null,
    expiresAt: new Date(now.getTime() + 2 * loginWindowMs)
  } }, { upsert: true });
}

async function issueSession(db, user, request) {
  const token = randomBytes(32).toString('base64url');
  const now = new Date();
  await db.collection('auth_sessions').insertOne({
    tokenHash: hashToken(token),
    userId: user._id,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + sessionLifetimeMs),
    ipHash: hashToken(clientAddress(request)),
    userAgent: String(request.headers['user-agent'] || '').slice(0, 300)
  });
  return { token, user: safeUser(user) };
}

async function sendOtpEmail(email, code, purpose) {
  requireConfiguration({ email: true });
  const reset = purpose === 'reset-password';
  const subject = reset ? 'Reset your Vijetha password' : 'Verify your Vijetha email';
  const action = reset ? 'reset your password' : 'verify your email address';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM,
      to: [email],
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#17292d"><h1 style="font-size:26px">Vijetha verification</h1><p>Use this one-time code to ${action}:</p><p style="font-size:34px;font-weight:800;letter-spacing:8px;color:#237f76">${code}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`
    })
  });
  if (!response.ok) throw new AuthError(502, 'EMAIL_DELIVERY_FAILED', 'The verification email could not be sent. Please try again.');
}

async function createOtp(db, email, purpose) {
  const now = new Date();
  const latest = await db.collection('auth_otps').findOne({ email, purpose, createdAt: { $gt: new Date(now.getTime() - 60000) } });
  if (latest) throw new AuthError(429, 'OTP_COOLDOWN', 'Please wait one minute before requesting another code.');
  const sentLastHour = await db.collection('auth_otps').countDocuments({ email, purpose, createdAt: { $gt: new Date(now.getTime() - 60 * 60 * 1000) } });
  if (sentLastHour >= 5) throw new AuthError(429, 'OTP_RATE_LIMITED', 'Too many codes requested. Try again later.');
  const code = String(randomInt(100000, 1000000));
  const otp = {
    email,
    purpose,
    codeHash: hashOtp(email, purpose, code),
    attemptsLeft: 5,
    createdAt: now,
    expiresAt: new Date(now.getTime() + otpLifetimeMs),
    usedAt: null
  };
  const result = await db.collection('auth_otps').insertOne(otp);
  try {
    await sendOtpEmail(email, code, purpose);
  } catch (error) {
    await db.collection('auth_otps').deleteOne({ _id: result.insertedId });
    throw error;
  }
}

export async function registerAccount(input) {
  requireConfiguration({ email: true });
  const db = await getTestingDatabase();
  const email = normalizeEmail(input.email);
  const name = String(input.name || '').trim().replace(/\s+/g, ' ');
  validateEmail(email);
  validateName(name);
  validatePassword(input.password);
  const existing = await db.collection('auth_users').findOne({ email });
  if (existing?.emailVerifiedAt) throw new AuthError(409, 'ACCOUNT_EXISTS', 'An account already exists for this email. Sign in instead.');
  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  await db.collection('auth_users').updateOne({ email }, { $set: {
    name, email, passwordHash, role: existing?.role || 'teacher', status: 'pending', updatedAt: now
  }, $setOnInsert: { createdAt: now, emailVerifiedAt: null } }, { upsert: true });
  await createOtp(db, email, 'verify-email');
  return { email, message: 'A six-digit verification code was sent to your email.' };
}

export async function requestOtp(input) {
  requireConfiguration({ email: true });
  const db = await getTestingDatabase();
  const email = normalizeEmail(input.email);
  const purpose = input.purpose === 'reset-password' ? 'reset-password' : 'verify-email';
  validateEmail(email);
  const user = await db.collection('auth_users').findOne({ email });
  const eligible = purpose === 'reset-password' ? Boolean(user?.emailVerifiedAt) : Boolean(user && !user.emailVerifiedAt);
  if (eligible) await createOtp(db, email, purpose);
  return { email, message: 'If this account is eligible, a verification code has been sent.' };
}

export async function verifyOtpCode(input, request) {
  requireConfiguration();
  const db = await getTestingDatabase();
  const email = normalizeEmail(input.email);
  const purpose = input.purpose === 'reset-password' ? 'reset-password' : 'verify-email';
  const code = String(input.code || '').trim();
  validateEmail(email);
  if (!/^\d{6}$/.test(code)) throw new AuthError(400, 'INVALID_OTP', 'Enter the six-digit code from your email.');
  const now = new Date();
  const otp = await db.collection('auth_otps').findOne({ email, purpose, usedAt: null, expiresAt: { $gt: now } }, { sort: { createdAt: -1 } });
  if (!otp || otp.attemptsLeft <= 0) throw new AuthError(400, 'INVALID_OTP', 'The code is invalid or has expired. Request a new code.');
  const suppliedHash = Buffer.from(hashOtp(email, purpose, code));
  const storedHash = Buffer.from(otp.codeHash);
  if (suppliedHash.length !== storedHash.length || !timingSafeEqual(suppliedHash, storedHash)) {
    await db.collection('auth_otps').updateOne({ _id: otp._id }, { $inc: { attemptsLeft: -1 } });
    throw new AuthError(400, 'INVALID_OTP', 'The code is invalid or has expired. Request a new code.');
  }
  const user = await db.collection('auth_users').findOne({ email });
  if (!user) throw new AuthError(400, 'INVALID_OTP', 'The code is invalid or has expired. Request a new code.');
  if (purpose === 'reset-password') validatePassword(input.newPassword);
  await db.collection('auth_otps').updateOne({ _id: otp._id }, { $set: { usedAt: now } });
  if (purpose === 'reset-password') {
    await db.collection('auth_users').updateOne({ _id: user._id }, { $set: { passwordHash: await hashPassword(input.newPassword), updatedAt: now }, $inc: { sessionVersion: 1 } });
    await db.collection('auth_sessions').deleteMany({ userId: user._id });
  } else {
    await db.collection('auth_users').updateOne({ _id: user._id }, { $set: { emailVerifiedAt: now, status: 'active', updatedAt: now } });
    user.emailVerifiedAt = now;
    user.status = 'active';
  }
  await db.collection('auth_otps').deleteMany({ email, purpose });
  const refreshedUser = purpose === 'reset-password' ? await db.collection('auth_users').findOne({ _id: user._id }) : user;
  return issueSession(db, refreshedUser, request);
}

export async function loginAccount(input, request) {
  requireConfiguration();
  const db = await getTestingDatabase();
  const email = normalizeEmail(input.email);
  validateEmail(email);
  const attemptKey = await ensureLoginAllowed(db, email, request);
  const user = await db.collection('auth_users').findOne({ email });
  const valid = user?.emailVerifiedAt && user.status === 'active' && await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    await recordLoginFailure(db, attemptKey);
    throw new AuthError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect, or the email is not verified.');
  }
  await db.collection('auth_attempts').deleteOne({ _id: attemptKey });
  return issueSession(db, user, request);
}

export async function sessionUser(request) {
  if (!authConfiguration().database || !authConfiguration().secret) return null;
  const token = requestSessionToken(request);
  if (!token) return null;
  const db = await getTestingDatabase();
  const session = await db.collection('auth_sessions').findOne({ tokenHash: hashToken(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  const user = await db.collection('auth_users').findOne({ _id: session.userId, status: 'active', emailVerifiedAt: { $ne: null } });
  if (!user) return null;
  await db.collection('auth_sessions').updateOne({ _id: session._id }, { $set: { lastSeenAt: new Date() } });
  return safeUser(user);
}

export async function logoutAccount(request) {
  if (!authConfiguration().database || !authConfiguration().secret) return;
  const token = requestSessionToken(request);
  if (!token) return;
  const db = await getTestingDatabase();
  await db.collection('auth_sessions').deleteOne({ tokenHash: hashToken(token) });
}

export function sendAuthError(response, error) {
  const status = error instanceof AuthError ? error.status : 500;
  const code = error instanceof AuthError ? error.code : 'AUTH_ERROR';
  const message = error instanceof AuthError ? error.message : 'Authentication could not be completed. Please try again.';
  if (!(error instanceof AuthError)) console.error('Authentication error:', error);
  return response.status(status).json({ error: message, code });
}
