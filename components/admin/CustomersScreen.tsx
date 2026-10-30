'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Download,
  Mail,
  Phone,
  RefreshCw,
  Search,
} from 'lucide-react';
import {
  adminExportCustomersCsv,
  adminListCustomers,
  adminSaveCustomerNote,
} from '@/actions/admin-crm';
import { shopNow } from '@/lib/booking-rules';
import type { Customer } from '@/lib/admin-types';
import CustomerHistory from './CustomerHistory';
import { downloadCsv, shortDate, ui, useAdmin } from './ui';

type Sort = 'recent' | 'name' | 'visits';

interface CustomersScreenProps {
  /** A customer to open right away (e.g. from a booking). */
  openKey: string | null;
  onOpened: () => void;
}

/** Most recent activity, for sorting: next booking, last visit, or first contact. */
const activity = (c: Customer) =>
  c.nextBooking?.date ?? c.history[0]?.date ?? c.lastVisit ?? c.firstSeen ?? '';

function CustomerDetail({
  customer,
  onBack,
  onNoteSaved,
}: {
  customer: Customer;
  onBack: () => void;
  onNoteSaved: (note: string) => void;
}) {
  const { call, notify, prefillBooking } = useAdmin();
  const [note, setNote] = useState(customer.note);
  const [saving, setSaving] = useState(false);

  useEffect(() => setNote(customer.note), [customer.key, customer.note]);

  const saveNote = async () => {
    setSaving(true);
    const result = await call((token) =>
      adminSaveCustomerNote(token, customer.key, note),
    );
    setSaving(false);
    if (!result.ok) return;
    onNoteSaved(result.data);
    notify(result.data ? 'Note saved.' : 'Note removed.', 'success');
  };

  const [first, ...rest] = customer.name.split(' ');
  const stats = [
    ['Bookings', customer.bookings],
    ['Completed', customer.completed],
    ['No-shows', customer.noShows],
    ['Quotes', customer.quotes],
  ] as const;

  return (
    <div className={`${ui.card} space-y-5 p-4 lg:p-5`}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-300 hover:text-white lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" /> All customers
      </button>

      <div>
        <h2 className="text-xl font-bold">
          {customer.name || customer.email || 'Customer'}
        </h2>
        <p className="text-sm text-slate-400">
          Customer since{' '}
          {customer.firstSeen ? shortDate(customer.firstSeen) : '—'}
          {customer.nextBooking && (
            <span className="text-emerald-300">
              {' '}
              · Next: {shortDate(customer.nextBooking.date)} at{' '}
              {customer.nextBooking.time}
            </span>
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className={ui.button}>
            <Phone className="h-4 w-4 text-red-400" /> {customer.phone}
          </a>
        )}
        {customer.email && (
          <a
            href={`mailto:${customer.email}`}
            className={`${ui.button} max-w-full`}
          >
            <Mail className="h-4 w-4 shrink-0 text-red-400" />
            <span className="truncate">{customer.email}</span>
          </a>
        )}
        <button
          type="button"
          className={ui.primary}
          onClick={() =>
            prefillBooking({
              firstName: first ?? '',
              lastName: rest.join(' '),
              phone: customer.phone,
              email: customer.email,
            })
          }
        >
          Book again
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {stats.map(([label, value]) => (
          <div
            key={label}
            className="rounded-lg bg-slate-900/50 p-2.5 text-center"
          >
            <p
              className={`text-xl font-bold ${label === 'No-shows' && value > 0 ? 'text-red-300' : ''}`}
            >
              {value}
            </p>
            <p className="text-xs text-slate-400">{label}</p>
          </div>
        ))}
      </div>

      {customer.vehicles.length > 0 && (
        <p className="text-sm lg:text-[15px]">
          <span className="text-slate-400">Vehicles: </span>
          {customer.vehicles.join(' · ')}
        </p>
      )}

      <div className="space-y-2">
        <label
          htmlFor="customer-note"
          className="text-sm font-semibold uppercase tracking-wider text-slate-400"
        >
          Customer note
        </label>
        <textarea
          id="customer-note"
          rows={2}
          maxLength={1000}
          className={`${ui.input} resize-y`}
          placeholder="Prefers texts"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={ui.button}
            disabled={saving || note.trim() === customer.note}
            onClick={saveNote}
          >
            Save note
          </button>
          <span className="text-xs text-slate-500">
            Shows on all of this customer&apos;s bookings.
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          History
        </h3>
        <CustomerHistory customer={customer} />
      </div>
    </div>
  );
}

export default function CustomersScreen({
  openKey,
  onOpened,
}: CustomersScreenProps) {
  const { call, notify } = useAdmin();
  const [list, setList] = useState<Customer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<Sort>('recent');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await call((token) => adminListCustomers(token));
    setLoading(false);
    if (result.ok) setList(result.data);
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!openKey || !list) return;
    setSelectedKey(openKey);
    onOpened();
  }, [openKey, list, onOpened]);

  const select = (key: string | null) => {
    setSelectedKey(key);
    if (typeof window !== 'undefined' && window.innerWidth < 1024)
      window.scrollTo(0, 0);
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    const items = (list ?? []).filter((c) => {
      if (!q) return true;
      const text = [c.name, c.email, ...c.vehicles].join(' ').toLowerCase();
      return (
        text.includes(q) ||
        (digits.length >= 3 && c.phone.replace(/\D/g, '').includes(digits))
      );
    });
    if (sort === 'name') items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === 'visits')
      items.sort(
        (a, b) => b.completed - a.completed || b.bookings - a.bookings,
      );
    else items.sort((a, b) => activity(b).localeCompare(activity(a)));
    return items;
  }, [list, query, sort]);

  const selected = list?.find((c) => c.key === selectedKey) ?? null;
  const today = shopNow().date;

  const exportCsv = async () => {
    const result = await call((token) => adminExportCustomersCsv(token));
    if (!result.ok) return;
    downloadCsv(result.data, `customers_${today}.csv`);
    notify('Spreadsheet downloaded.', 'success');
  };

  return (
    <div className="space-y-5">
      <div
        className={`flex flex-wrap items-center gap-2 ${selected ? 'hidden lg:flex' : ''}`}
      >
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className={`${ui.input} pl-9`}
            placeholder="Search name, phone, email or car"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search customers"
          />
        </div>
        <select
          className={`${ui.input} !w-auto`}
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort customers"
        >
          <option value="recent">Most recent</option>
          <option value="name">Name</option>
          <option value="visits">Most visits</option>
        </select>
        <button type="button" className={ui.button} onClick={exportCsv}>
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className={selected ? 'hidden lg:block' : ''}>
          {list === null ? (
            <p className="py-10 text-center text-slate-400">
              Loading customers...
            </p>
          ) : visible.length === 0 ? (
            <div className={`${ui.card} p-8 text-center text-slate-400`}>
              {query ? 'No customers match this search.' : 'No customers yet.'}
            </div>
          ) : (
            <>
              <p className="mb-2 text-sm text-slate-400">
                {visible.length} customer{visible.length === 1 ? '' : 's'}
              </p>
              <ul
                className={`${ui.card} divide-y divide-white/10 overflow-hidden`}
              >
                {visible.map((c) => (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => select(c.key)}
                      className={`grid w-full grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-left transition sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.2fr)_60px_minmax(0,1fr)] ${
                        c.key === selectedKey
                          ? 'bg-slate-700'
                          : 'hover:bg-slate-700/50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">
                          {c.name || c.email}
                        </span>
                        <span className="block truncate text-sm text-slate-400">
                          {c.phone || c.email}
                        </span>
                      </span>
                      <span className="hidden min-w-0 text-sm sm:block">
                        <span className="block truncate">
                          {c.vehicles[0] ?? '—'}
                        </span>
                        {c.vehicles.length > 1 && (
                          <span className="block text-xs text-slate-400">
                            +{c.vehicles.length - 1} more
                          </span>
                        )}
                      </span>
                      <span className="hidden text-center text-sm sm:block">
                        {c.completed}
                        <span className="block text-xs text-slate-500">
                          visits
                        </span>
                      </span>
                      <span className="min-w-0 text-right text-sm sm:text-left">
                        {c.nextBooking ? (
                          <span className="block text-emerald-300">
                            Next: {shortDate(c.nextBooking.date)}
                          </span>
                        ) : c.lastVisit ? (
                          <span className="block">
                            Last: {shortDate(c.lastVisit)}
                          </span>
                        ) : (
                          <span className="block text-slate-400">
                            {c.quotes > 0 && c.bookings === 0
                              ? 'Quote only'
                              : 'No visits yet'}
                          </span>
                        )}
                        {c.noShows > 0 && (
                          <span className="mt-0.5 inline-block rounded-full bg-red-500/20 px-2 text-xs text-red-200">
                            {c.noShows} no-show{c.noShows === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className={selected ? '' : 'hidden lg:block'}>
          <div className="lg:sticky lg:top-24">
            {selected ? (
              <CustomerDetail
                customer={selected}
                onBack={() => select(null)}
                onNoteSaved={(note) =>
                  setList((current) =>
                    (current ?? []).map((c) =>
                      c.key === selected.key ? { ...c, note } : c,
                    ),
                  )
                }
              />
            ) : (
              <div className={`${ui.card} p-8 text-center text-slate-400`}>
                Choose a customer to see their history.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
