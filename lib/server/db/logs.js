import 'server-only';
import { db, ensureInitialized } from './connection';

export async function logErrorToDb(source, message, stack = '') {
  try {
    await ensureInitialized();
    const errorLog = {
      source,
      message,
      stack: stack || '',
      created_at: new Date().toISOString()
    };
    await db.collection('error_logs').add(errorLog);
  } catch (err) {
    console.error('CRITICAL: Failed to write error log to Firestore:', err.message);
  }
}
