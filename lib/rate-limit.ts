// Simple per-visitor limits (by a hash of the IP address, never the raw IP).
import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { Timestamp } from 'firebase-admin/firestore';
import { dbAdmin } from '@/utils/firebaseAdmin';

async function visitorHash(): Promise<string> {
  const h = await headers();
  const ip =
    h.get('x-nf-client-connection-ip') ||
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip') ||
    'unknown';
  return createHash('sha256').update(ip).digest('hex').slice(0, 32);
}

/** Returns false once this visitor has done `bucket` more than `max` times in the window. */
export async function underRateLimit(
  bucket: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const ref = dbAdmin
    .collection('rate_limits')
    .doc(`${bucket}_${await visitorHash()}`);
  const now = Date.now();
  let allowed = true;
  await dbAdmin.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const recent = (
      (snap.get('requests') as number[] | undefined) ?? []
    ).filter((t) => t > now - windowMs);
    if (recent.length >= max) {
      allowed = false;
      return;
    }
    tx.set(ref, { requests: [...recent, now], updatedAt: Timestamp.now() });
  });
  return allowed;
}
