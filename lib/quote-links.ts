// When someone books, mark the quotes they requested as booked.
import { Timestamp } from 'firebase-admin/firestore';
import { dbAdmin } from '@/utils/firebaseAdmin';

export async function markQuotesBooked({
  quoteId,
  email,
  bookingId,
}: {
  quoteId?: string | null;
  email?: string | null;
  bookingId: string;
}): Promise<void> {
  try {
    const quotes = dbAdmin.collection('quotes');
    const update = { status: 'booked', bookingId, bookedAt: Timestamp.now() };

    if (quoteId && typeof quoteId === 'string' && quoteId.length < 100) {
      const ref = quotes.doc(quoteId);
      const snap = await ref.get();
      if (snap.exists && snap.get('status') !== 'booked')
        await ref.update(update);
    }

    const mail = (email ?? '').trim().toLowerCase();
    if (mail) {
      const open = await quotes.where('email', '==', mail).get();
      await Promise.all(
        open.docs
          .filter(
            (d) => d.get('status') === 'new' || d.get('status') === 'contacted',
          )
          .map((d) => d.ref.update(update)),
      );
    }
  } catch (error) {
    // Linking a quote must never stop a booking from being saved.
    console.error('[Quotes] Could not mark quotes as booked:', error);
  }
}
