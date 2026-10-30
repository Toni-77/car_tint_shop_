// Server side of the admin sign-in: every admin action calls requireAdmin first.
import { getAuth } from 'firebase-admin/auth';
import '@/utils/firebaseAdmin'; // makes sure the Firebase Admin app is started

export class AdminAuthError extends Error {}

/**
 * Checks the sign-in token and that it belongs to the shop owner (ADMIN_EMAIL,
 * and ADMIN_UID too if it's set). Returns the owner's email.
 */
export async function requireAdmin(idToken: unknown): Promise<string> {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!adminEmail) {
    throw new AdminAuthError('ADMIN_EMAIL is not set on the server.');
  }
  if (typeof idToken !== 'string' || !idToken) {
    throw new AdminAuthError('You are signed out. Sign in again.');
  }

  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    throw new AdminAuthError('Your session expired. Sign in again.');
  }

  const adminUid = process.env.ADMIN_UID?.trim();
  if (
    decoded.email?.toLowerCase() !== adminEmail ||
    (adminUid && decoded.uid !== adminUid)
  ) {
    throw new AdminAuthError('This account does not have admin access.');
  }
  return adminEmail;
}
