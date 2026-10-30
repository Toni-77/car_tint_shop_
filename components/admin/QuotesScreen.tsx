'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Mail, RefreshCw } from 'lucide-react';
import {
  adminExportQuotesCsv,
  adminListQuotes,
  adminSetQuoteStatus,
} from '@/actions/admin-crm';
import { addDays, shopNow, startOfWeek } from '@/lib/booking-rules';
import { formatPriceRange } from '@/lib/pricing';
import {
  QUOTE_STATUS_LABELS,
  type AdminQuote,
  type QuoteStatus,
} from '@/lib/quote-types';
import { downloadCsv, ui, useAdmin } from './ui';

type View = 'contact' | 'all';

const STATUS_STYLES: Record<QuoteStatus, string> = {
  new: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
  contacted: 'border-slate-400/40 bg-slate-400/10 text-slate-300',
  booked: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200',
};

function when(iso: string) {
  if (!iso) return '';
  const date = new Date(iso);
  const today = shopNow().date;
  const day = shopNow(date).date;
  const time = date.toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
  });
  if (day === today) return `Today ${time}`;
  if (day === addDays(today, -1)) return `Yesterday ${time}`;
  return date.toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
  });
}

export default function QuotesScreen() {
  const { call, notify, prefillBooking, refreshNewQuotes, openBooking } =
    useAdmin();
  const [list, setList] = useState<AdminQuote[] | null>(null);
  const [view, setView] = useState<View>('contact');
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await call((token) => adminListQuotes(token, 120));
    setLoading(false);
    if (result.ok) setList(result.data);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const withContact = useMemo(
    () => (list ?? []).filter((q) => q.email),
    [list],
  );
  const shown = view === 'contact' ? withContact : (list ?? []);

  // This week's estimates by service (shows what people are pricing).
  const week = useMemo(() => {
    const start = startOfWeek(shopNow().date);
    const thisWeek = (list ?? []).filter(
      (q) => shopNow(new Date(q.createdAt)).date >= start,
    );
    const by = (service: string) =>
      thisWeek.filter((q) => q.service === service).length;
    return {
      total: thisWeek.length,
      tint: by('Window Tint'),
      coating: by('Ceramic Coating'),
      ppf: by('Paint Protection Film'),
    };
  }, [list]);

  const setStatus = async (quote: AdminQuote, status: 'new' | 'contacted') => {
    setBusyId(quote.id);
    const result = await call((token) =>
      adminSetQuoteStatus(token, quote.id, status),
    );
    setBusyId(null);
    if (!result.ok) return;
    setList((current) =>
      (current ?? []).map((q) => (q.id === quote.id ? result.data : q)),
    );
    refreshNewQuotes();
    notify(
      status === 'contacted' ? 'Marked as contacted.' : 'Marked as new.',
      'success',
    );
  };

  const book = (quote: AdminQuote) => {
    const isTint = quote.service === 'Window Tint';
    prefillBooking({
      quoteId: quote.id,
      email: quote.email,
      vehicleType: quote.vehicleType,
      service: quote.service,
      ...(isTint
        ? {
            tintWindows: quote.tintWindows,
            filmRemoval: quote.removeOldTint ? 'Yes' : 'No',
          }
        : {}),
      notes: `Quote: ${quote.summary} (${formatPriceRange([quote.priceLow, quote.priceHigh])})`,
    });
  };

  const exportCsv = async () => {
    const result = await call((token) => adminExportQuotesCsv(token, 365));
    if (!result.ok) return;
    downloadCsv(result.data, `quotes_${shopNow().date}.csv`);
    notify('Spreadsheet downloaded.', 'success');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-600 p-0.5">
          {(
            [
              ['contact', `With contact ${withContact.length}`],
              ['all', `All estimates ${list?.length ?? 0}`],
            ] as [View, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                view === v
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={`${ui.button} ml-auto`}
          onClick={exportCsv}
        >
          <Download className="h-4 w-4" /> Export
        </button>
        <button
          type="button"
          className={ui.button}
          onClick={() => void load()}
          disabled={loading}
          aria-label="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {list && (
        <p className="text-sm text-slate-400">
          This week:{' '}
          <span className="font-semibold text-slate-200">{week.total}</span>{' '}
          estimate{week.total === 1 ? '' : 's'} · window tint {week.tint} ·
          ceramic coating {week.coating} · PPF {week.ppf}
        </p>
      )}

      {list === null ? (
        <p className="py-10 text-center text-slate-400">Loading quotes...</p>
      ) : shown.length === 0 ? (
        <div className={`${ui.card} p-8 text-center text-slate-400`}>
          {view === 'contact'
            ? 'No quote requests yet. When a visitor asks for their estimate by email, it shows up here.'
            : 'No estimates in the last 120 days.'}
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((q) => (
            <li
              key={q.id}
              className={`${ui.card} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {q.email ? (
                    <a
                      href={`mailto:${q.email}`}
                      className="inline-flex items-center gap-1.5 truncate font-semibold hover:text-red-300"
                    >
                      <Mail className="h-4 w-4 shrink-0 text-red-400" />
                      {q.email}
                    </a>
                  ) : (
                    <span className="font-semibold text-slate-300">
                      No contact left
                    </span>
                  )}
                  {q.status ? (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[q.status]}`}
                    >
                      {QUOTE_STATUS_LABELS[q.status]}
                    </span>
                  ) : (
                    <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-400">
                      Estimate only
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-slate-400 lg:text-[15px]">
                  {when(q.createdAt)} · {q.vehicleType} · {q.service}:{' '}
                  {q.summary} ·{' '}
                  <span className="font-semibold text-slate-200">
                    {formatPriceRange([q.priceLow, q.priceHigh])}
                  </span>
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {q.status === 'new' && (
                  <button
                    type="button"
                    className={ui.button}
                    disabled={busyId === q.id}
                    onClick={() => setStatus(q, 'contacted')}
                  >
                    Mark contacted
                  </button>
                )}
                {q.status === 'contacted' && (
                  <button
                    type="button"
                    className="text-sm text-slate-400 hover:text-white"
                    disabled={busyId === q.id}
                    onClick={() => setStatus(q, 'new')}
                  >
                    Undo
                  </button>
                )}
                {q.status === 'booked' && q.bookingId ? (
                  <button
                    type="button"
                    className={ui.button}
                    onClick={() => openBooking(q.bookingId)}
                  >
                    View booking
                  </button>
                ) : (
                  q.email && (
                    <button
                      type="button"
                      className={ui.primary}
                      onClick={() => book(q)}
                    >
                      Book now
                    </button>
                  )
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
