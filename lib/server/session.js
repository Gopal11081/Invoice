import 'server-only';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const COOKIE_NAME = 'invoice-gst-session';

function getKey(secret) {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text, secret) {
  const key = getKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString('hex'),
    t: tag.toString('hex'),
    e: encrypted
  });
}

export function decrypt(encText, secret) {
  try {
    const { iv, t, e } = JSON.parse(encText);
    const key = getKey(secret);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(t, 'hex'));
    let decrypted = decipher.update(e, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return null;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const encryptedSession = cookieStore.get(COOKIE_NAME)?.value;
  if (!encryptedSession) return null;
  const secret = process.env.SESSION_SECRET || 'invoice-gst-session-secret-key-12345';
  const decrypted = decrypt(encryptedSession, secret);
  if (!decrypted) return null;
  try {
    return JSON.parse(decrypted);
  } catch (err) {
    return null;
  }
}

export async function setSession(sessionData) {
  const secret = process.env.SESSION_SECRET || 'invoice-gst-session-secret-key-12345';
  const encrypted = encrypt(JSON.stringify(sessionData), secret);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/'
  });
}

export async function deleteSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function verifyAuth(allowedRoles = []) {
  const session = await getSession();
  if (!session) {
    return { error: 'Authentication required', status: 401 };
  }
  if (allowedRoles.length > 0 && !allowedRoles.includes(session.role)) {
    return { error: 'Access denied. Privileges required.', status: 403 };
  }
  return { session };
}
