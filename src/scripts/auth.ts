// Inicio de sesión de clientes con Firebase Authentication
// (enlace por correo o código por SMS). Sólo se carga si Firebase está configurado.
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  onIdTokenChanged,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut as fbSignOut,
  fetchSignInMethodsForEmail,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  browserLocalPersistence,
  setPersistence,
  type User,
  type ConfirmationResult,
} from 'firebase/auth';

export const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID as string | undefined,
};

export const authEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId);

const EMAIL_KEY = 'rj-email-for-signin';

let auth: ReturnType<typeof getAuth> | null = null;
function getA() {
  if (!authEnabled) throw new Error('auth disabled');
  if (!auth) {
    auth = getAuth(initializeApp(firebaseConfig as Required<typeof firebaseConfig>));
    auth.languageCode = document.documentElement.lang || 'es';
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }
  return auth;
}

/** Llama a cb con el usuario (o null) y un token vigente cada vez que cambian. */
export function watchUser(cb: (user: User | null, token: string) => void) {
  if (!authEnabled) {
    cb(null, '');
    return;
  }
  onIdTokenChanged(getA(), async (user) => {
    cb(user, user ? await user.getIdToken() : '');
  });
}

export async function freshToken(): Promise<string> {
  const u = authEnabled ? getA().currentUser : null;
  return u ? u.getIdToken() : '';
}

export async function sendEmailLink(email: string, returnUrl: string) {
  await sendSignInLinkToEmail(getA(), email, { url: returnUrl, handleCodeInApp: true });
  try {
    localStorage.setItem(EMAIL_KEY, email);
  } catch {}
}

export function isEmailLink() {
  return authEnabled && isSignInWithEmailLink(getA(), location.href);
}

export function rememberedEmail() {
  try {
    return localStorage.getItem(EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

export async function finishEmailLink(email: string) {
  await signInWithEmailLink(getA(), email, location.href);
  try {
    localStorage.removeItem(EMAIL_KEY);
  } catch {}
  // Quitar el código del enlace de la barra de direcciones
  history.replaceState(null, '', location.pathname);
}

let verifier: RecaptchaVerifier | null = null;
export async function sendPhoneCode(phone: string, buttonId: string): Promise<ConfirmationResult> {
  const a = getA();
  if (!verifier) verifier = new RecaptchaVerifier(a, buttonId, { size: 'invisible' });
  try {
    return await signInWithPhoneNumber(a, phone, verifier);
  } catch (e) {
    verifier.clear();
    verifier = null;
    throw e;
  }
}

/**
 * Cómo puede entrar este correo: 'password', 'link' (sólo enlace) o 'none'.
 * Ojo: si en Firebase está activada la "protección contra la enumeración de
 * correos" (Authentication → Settings), siempre responde 'none'; el pago lo
 * resuelve igual porque "Crear cuenta" detecta el correo ya registrado.
 */
export async function emailStatus(email: string): Promise<'password' | 'link' | 'none'> {
  const methods = await fetchSignInMethodsForEmail(getA(), email);
  if (methods.includes('password')) return 'password';
  if (methods.includes('emailLink')) return 'link';
  return methods.length ? 'link' : 'none';
}

export async function signInPassword(email: string, password: string) {
  await signInWithEmailAndPassword(getA(), email, password);
}

export async function createAccount(email: string, password: string) {
  await createUserWithEmailAndPassword(getA(), email, password);
}

export async function sendReset(email: string) {
  await sendPasswordResetEmail(getA(), email);
}

export function signOut() {
  return fbSignOut(getA());
}

/** "+505 8888-8888" → "+50588888888"; sin "+" se asume Nicaragua (+505). */
export function normalizePhone(raw: string) {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return '+' + digits.slice(1).replace(/\D/g, '');
  if (digits.startsWith('00')) return '+' + digits.slice(2);
  return '+505' + digits;
}

export function errorKey(e: unknown) {
  const code = (e as { code?: string })?.code || '';
  if (code.includes('invalid-verification-code') || code.includes('code-expired')) return 'acc.error.code';
  if (code.includes('invalid-phone-number') || code.includes('missing-phone-number')) return 'acc.error.phone';
  if (code.includes('wrong-password') || code.includes('invalid-credential') || code.includes('invalid-login')) return 'co.err.password';
  if (code.includes('weak-password')) return 'co.err.weak';
  if (code.includes('email-already-in-use')) return 'co.err.inUse';
  if (code.includes('invalid-email') || code.includes('missing-email')) return 'co.err.email';
  if (code.includes('too-many-requests') || code.includes('quota-exceeded')) return 'acc.error.tooMany';
  return 'acc.error';
}

export type { User, ConfirmationResult };
