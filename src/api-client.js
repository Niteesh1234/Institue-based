import { Capacitor } from '@capacitor/core';

export const NATIVE_PLATFORM = Capacitor.getPlatform();
export const IS_NATIVE_APP = Capacitor.isNativePlatform();
export const NATIVE_API_BASE_URL = 'https://vijetha-jnvst-testing.vercel.app';
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (IS_NATIVE_APP
    ? NATIVE_API_BASE_URL
    : '');
export const PUBLIC_APP_URL = IS_NATIVE_APP ? NATIVE_API_BASE_URL : window.location.origin;

const nativeSessionKey = 'vijetha_native_session';

export async function rawAuthRequest(path, options = {}) {
  const nativeToken = IS_NATIVE_APP ? window.localStorage.getItem(nativeSessionKey) : '';
  const { headers: optionHeaders = {}, ...requestOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: IS_NATIVE_APP ? 'omit' : 'include',
    ...requestOptions,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(IS_NATIVE_APP ? { 'X-Vijetha-Platform': NATIVE_PLATFORM } : {}),
      ...(nativeToken ? { Authorization: `Bearer ${nativeToken}` } : {}),
      ...optionHeaders,
    },
  });
  if (IS_NATIVE_APP && response.status === 401) window.localStorage.removeItem(nativeSessionKey);
  return response;
}

export async function authRequest(path, options = {}) {
  const response = await rawAuthRequest(path, options);
  const payload = await response.json().catch(() => ({}));
  if (IS_NATIVE_APP && payload.sessionToken) window.localStorage.setItem(nativeSessionKey, payload.sessionToken);
  if (!response.ok) {
    const error = new Error(payload.error || 'The request could not be completed.');
    error.code = payload.code;
    throw error;
  }
  return payload;
}

export function clearNativeSession() {
  if (IS_NATIVE_APP) window.localStorage.removeItem(nativeSessionKey);
}
