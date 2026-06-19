import 'server-only';
import admin from 'firebase-admin';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db, ensureInitialized, getNextId } from './connection';

export async function getUserByUsername(username) {
  await ensureInitialized();
  const cleanUsername = (username || '').toLowerCase().trim();
  const snapshot = await db.collection('users').where('username', '==', cleanUsername).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

export async function getUserByEmail(email) {
  await ensureInitialized();
  const cleanEmail = (email || '').toLowerCase().trim();
  if (!cleanEmail) return null;
  const snapshot = await db.collection('users').where('email', '==', cleanEmail).limit(1).get();
  if (snapshot.empty) return null;
  return snapshot.docs[0].data();
}

export async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

export async function changePassword(userId, newPassword) {
  await ensureInitialized();
  const hash = await bcrypt.hash(newPassword, 10);
  await db.collection('users').doc(userId.toString()).update({ password_hash: hash });
}

export async function saveResetToken(userId, token, expiry) {
  await ensureInitialized();
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  await db.collection('users').doc(userId.toString()).update({
    reset_token: hashedToken,
    reset_token_expiry: expiry.toISOString()
  });
}

export async function validateResetToken(email, token) {
  await ensureInitialized();
  const user = await getUserByEmail(email);
  if (!user) return false;
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
  if (!user.reset_token || user.reset_token !== hashedToken) return false;
  if (!user.reset_token_expiry) return false;
  const expiry = new Date(user.reset_token_expiry);
  if (expiry < new Date()) return false;
  return true;
}

export async function resetUserPassword(email, newPassword) {
  await ensureInitialized();
  const user = await getUserByEmail(email);
  if (!user) throw new Error('User not found');
  const hash = await bcrypt.hash(newPassword, 10);
  await db.collection('users').doc(user.id.toString()).update({
    password_hash: hash,
    reset_token: admin.firestore.FieldValue.delete(),
    reset_token_expiry: admin.firestore.FieldValue.delete()
  });
}

export async function registerUser(data) {
  await ensureInitialized();
  const id = await getNextId('users');
  const hash = await bcrypt.hash(data.password, 10);
  const user = {
    id,
    username: data.username.toLowerCase().trim(),
    password_hash: hash,
    display_name: data.display_name.trim(),
    email: (data.email || '').trim(),
    mobile: (data.mobile || '').trim(),
    is_active: false,
    created_at: new Date().toISOString()
  };
  await db.collection('users').doc(id.toString()).set(user);
  return { id: user.id, username: user.username, display_name: user.display_name };
}

export async function getAllUsers() {
  await ensureInitialized();
  const snapshot = await db.collection('users').get();
  const list = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    list.push({
      id: data.id,
      username: data.username,
      display_name: data.display_name,
      email: data.email || '',
      mobile: data.mobile || '',
      is_active: data.is_active === undefined ? true : data.is_active,
      role: data.role || (data.id === 1 ? 'admin' : 'staff'),
      created_at: data.created_at
    });
  });
  list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return list;
}

export async function updateUserStatus(userId, isActive) {
  await ensureInitialized();
  await db.collection('users').doc(userId.toString()).update({
    is_active: isActive
  });
}

export async function updateUserRole(userId, role) {
  await ensureInitialized();
  await db.collection('users').doc(userId.toString()).update({
    role: role
  });
}

export async function updateUserFields(userId, data) {
  await ensureInitialized();
  const cleanUsername = data.username.toLowerCase().trim();
  const cleanEmail = (data.email || '').toLowerCase().trim();
  const cleanMobile = (data.mobile || '').trim();
  const cleanDisplayName = data.display_name.trim();

  // Check username uniqueness
  const usernameSnapshot = await db.collection('users')
    .where('username', '==', cleanUsername)
    .get();
  
  for (const doc of usernameSnapshot.docs) {
    if (doc.id !== userId.toString()) {
      throw new Error('Username is already taken');
    }
  }

  // Check email uniqueness
  if (cleanEmail) {
    const emailSnapshot = await db.collection('users')
      .where('email', '==', cleanEmail)
      .get();
    for (const doc of emailSnapshot.docs) {
      if (doc.id !== userId.toString()) {
        throw new Error('Email address is already registered by another user');
      }
    }
  }

  await db.collection('users').doc(userId.toString()).update({
    username: cleanUsername,
    display_name: cleanDisplayName,
    email: cleanEmail,
    mobile: cleanMobile
  });
}

export async function updateUserProfile(userId, data) {
  await ensureInitialized();
  const cleanEmail = (data.email || '').toLowerCase().trim();
  const cleanMobile = (data.mobile || '').trim();
  const cleanDisplayName = data.display_name.trim();

  // Check email uniqueness
  if (cleanEmail) {
    const emailSnapshot = await db.collection('users')
      .where('email', '==', cleanEmail)
      .get();
    for (const doc of emailSnapshot.docs) {
      if (doc.id !== userId.toString()) {
        throw new Error('Email address is already registered by another user');
      }
    }
  }

  const userDoc = await db.collection('users').doc(userId.toString()).get();
  if (!userDoc.exists) {
    throw new Error('User not found');
  }
  const user = userDoc.data();

  const updates = {
    display_name: cleanDisplayName,
    email: cleanEmail,
    mobile: cleanMobile
  };

  // If password change is requested
  if (data.new_password) {
    const isCurrentPasswordCorrect = await bcrypt.compare(data.current_password, user.password_hash);
    if (!isCurrentPasswordCorrect) {
      throw new Error('Current password is incorrect');
    }
    const newHash = await bcrypt.hash(data.new_password, 10);
    updates.password_hash = newHash;
  }

  await db.collection('users').doc(userId.toString()).update(updates);
  return {
    id: user.id,
    username: user.username,
    display_name: cleanDisplayName,
    role: user.role || (user.id === 1 ? 'admin' : 'staff')
  };
}
