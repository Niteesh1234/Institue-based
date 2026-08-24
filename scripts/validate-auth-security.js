import assert from 'node:assert/strict';
import { AuthError, clearSessionCookie, hashOtp, hashPassword, isNativeClient, sessionCookie, validatePassword, verifyPassword } from '../auth-service.js';

process.env.AUTH_SECRET = 'test-only-secret-with-at-least-thirty-two-characters';

const password = 'SecurePass2027';
const firstHash = await hashPassword(password);
const secondHash = await hashPassword(password);

assert.notEqual(firstHash, secondHash, 'Password hashes must use unique salts.');
assert.equal(await verifyPassword(password, firstHash), true, 'The correct password must verify.');
assert.equal(await verifyPassword('WrongPass2027', firstHash), false, 'An incorrect password must fail.');
assert.equal(firstHash.includes(password), false, 'The password must never appear in its stored hash.');

assert.equal(hashOtp('Teacher@Example.com', 'verify-email', '123456'), hashOtp('teacher@example.com', 'verify-email', '123456'), 'OTP hashing must normalize email addresses.');
assert.notEqual(hashOtp('teacher@example.com', 'verify-email', '123456'), hashOtp('teacher@example.com', 'verify-email', '654321'), 'Different OTPs must not share a hash.');
assert.equal(hashOtp('teacher@example.com', 'verify-email', '123456').includes('123456'), false, 'OTP storage must not contain the readable code.');

assert.throws(() => validatePassword('password'), (error) => error instanceof AuthError && error.code === 'WEAK_PASSWORD');

process.env.VERCEL_ENV = 'production';
const cookie = sessionCookie('random-session-token');
assert.match(cookie, /HttpOnly/);
assert.match(cookie, /SameSite=Lax/);
assert.match(cookie, /Secure/);
assert.match(clearSessionCookie(), /Max-Age=0/);

assert.equal(isNativeClient({ headers: { 'x-vijetha-platform': 'android' } }), true, 'Android must use the native session flow.');
assert.equal(isNativeClient({ headers: { 'x-vijetha-platform': 'ios' } }), true, 'iOS must use the native session flow.');
assert.equal(isNativeClient({ headers: { 'x-vijetha-platform': 'web' } }), false, 'Web requests must retain the cookie session flow.');

console.log(JSON.stringify({
  status: 'passed',
  passwordHashing: 'salted-scrypt',
  otpStorage: 'HMAC-SHA-256',
  sessionCookie: 'HttpOnly; SameSite=Lax; Secure',
  readableSecretsStored: false,
  nativePlatforms: ['android', 'ios']
}, null, 2));
