'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ClipboardList,
  LogOut,
  PlusCircle,
  Receipt,
  Users,
} from 'lucide-react';
import { adminCountNewQuotes } from '@/actions/admin-crm';
import {
  adminResetPassword,
  adminSignIn,
  adminSignOut,
  adminToken,
  watchAdminUser,
  type AdminUser,
} from '@/lib/admin-auth-client';
import type { ActionResult, AdminBookingPrefill } from '@/lib/admin-types';
import { AdminContext, ui, type AdminContextValue, type Tone } from './ui';
import BookingsScreen from './BookingsScreen';
import CalendarScreen from './CalendarScreen';
import AddBookingScreen from './AddBookingScreen';
import CustomersScreen from './CustomersScreen';
import QuotesScreen from './QuotesScreen';

type Tab = 'bookings' | 'calendar' | 'customers' | 'quotes' | 'add';

const TABS: { id: Tab; label: string; icon: typeof ClipboardList }[] = [
  { id: 'bookings', label: 'Bookings', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'quotes', label: 'Quotes', icon: Receipt },
  { id: 'add', label: 'Add booking', icon: PlusCircle },
];

function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(
    null,
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      await adminSignIn(email, password);
    } catch {
      setMessage({ text: 'Wrong email or password.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) {
      setMessage({
        text: 'Enter your email first, then choose Forgot password.',
        tone: 'warning',
      });
      return;
    }
    try {
      await adminResetPassword(email);
      setMessage({
        text: 'Check your email for a link to set a new password.',
        tone: 'success',
      });
    } catch {
      setMessage({
        text: 'Could not send the reset email. Check the address.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4">
      <form
        onSubmit={submit}
        className={`${ui.card} w-full max-w-sm space-y-4 p-6`}
      >
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">
            Supernova Tinting
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Admin sign in</h1>
        </div>
        {message && (
          <p
            role="alert"
            className={`rounded-lg border p-3 text-sm ${
              message.tone === 'success'
                ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'
                : message.tone === 'warning'
                  ? 'border-amber-400/40 bg-amber-400/10 text-amber-200'
                  : 'border-red-500/40 bg-red-500/10 text-red-200'
            }`}
          >
            {message.text}
          </p>
        )}
        <div>
          <label htmlFor="admin-email" className={ui.label}>
            Email
          </label>
          <input
            id="admin-email"
            type="email"
            autoComplete="username"
            className={ui.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="admin-password" className={ui.label}>
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            autoComplete="current-password"
            className={ui.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className={`${ui.primary} w-full py-3`}
        >
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="w-full text-center text-sm text-slate-400 hover:text-white"
        >
          Forgot password?
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const [user, setUser] = useState<AdminUser | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('bookings');
  const [openBookingId, setOpenBookingId] = useState<string | null>(null);
  const [bookingStart, setBookingStart] = useState<AdminBookingPrefill | null>(
    null,
  );
  const [openCustomerKey, setOpenCustomerKey] = useState<string | null>(null);
  const [newQuotes, setNewQuotes] = useState(0);
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  useEffect(() => watchAdminUser(setUser), []);

  const notify = useCallback((text: string, tone: Tone = 'success') => {
    setToast({ text, tone });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToast(null),
      tone === 'success' ? 4000 : 8000,
    );
  }, []);

  const call = useCallback(
    async <T,>(action: (token: string) => Promise<ActionResult<T>>) => {
      let result: ActionResult<T>;
      try {
        result = await action(await adminToken());
      } catch (error) {
        result = {
          ok: false,
          error:
            error instanceof Error && error.message
              ? error.message
              : 'Could not reach the server. Check your connection.',
        };
      }
      if (!result.ok) notify(result.error, 'error');
      return result;
    },
    [notify],
  );

  const refreshNewQuotes = useCallback(async () => {
    try {
      const result = await adminCountNewQuotes(await adminToken());
      if (result.ok) setNewQuotes(result.data);
    } catch {
      // The count is only a reminder; ignore errors.
    }
  }, []);

  useEffect(() => {
    if (user) void refreshNewQuotes();
  }, [user, refreshNewQuotes]);

  const context = useMemo<AdminContextValue>(
    () => ({
      notify,
      call,
      openBooking: (id) => {
        setOpenBookingId(id);
        setTab('bookings');
      },
      startBooking: (date, time) => {
        setBookingStart({ date, timeSlot: time });
        setTab('add');
      },
      prefillBooking: (prefill) => {
        setBookingStart(prefill);
        setTab('add');
      },
      openCustomer: (key) => {
        setOpenCustomerKey(key);
        setTab('customers');
      },
      newQuotes,
      refreshNewQuotes,
    }),
    [notify, call, newQuotes, refreshNewQuotes],
  );

  if (user === undefined) {
    return <div className="min-h-screen bg-slate-900" aria-busy="true" />;
  }
  if (user === null) return <SignIn />;

  return (
    <AdminContext.Provider value={context}>
      <div className="min-h-screen bg-slate-900 text-white">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-950/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-red-400">
                Supernova Tinting
              </p>
              <p className="truncate text-lg font-bold leading-tight">Admin</p>
            </div>
            <nav className="hidden gap-1 md:flex" aria-label="Admin sections">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={tab === id ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                    tab === id
                      ? 'bg-slate-700 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                  {id === 'quotes' && newQuotes > 0 && (
                    <span className="rounded-full bg-amber-400 px-1.5 text-[11px] font-bold leading-4 text-slate-900">
                      {newQuotes}
                    </span>
                  )}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="hidden text-sm text-slate-400 lg:inline">
                {user.email}
              </span>
              <button
                type="button"
                onClick={() => adminSignOut()}
                className={ui.button}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          </div>
          {/* Phones: section tabs under the header */}
          <nav
            className="flex border-t border-white/10 md:hidden"
            aria-label="Admin sections"
          >
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-semibold ${
                  tab === id ? 'text-white' : 'text-slate-400'
                }`}
              >
                <span className="relative">
                  <Icon
                    className={`h-5 w-5 ${tab === id ? 'text-red-400' : ''}`}
                  />
                  {id === 'quotes' && newQuotes > 0 && (
                    <span className="absolute -right-2.5 -top-1.5 rounded-full bg-amber-400 px-1 text-[10px] font-bold leading-4 text-slate-900">
                      {newQuotes}
                    </span>
                  )}
                </span>
                {label}
              </button>
            ))}
          </nav>
        </header>

        {toast && (
          <div className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
            <div
              role={toast.tone === 'success' ? 'status' : 'alert'}
              className={`flex w-full max-w-xl items-start justify-between gap-3 rounded-lg border p-3 text-sm shadow-2xl shadow-black/50 ${
                toast.tone === 'success'
                  ? 'border-emerald-400/40 bg-emerald-950 text-emerald-100'
                  : toast.tone === 'warning'
                    ? 'border-amber-400/40 bg-amber-950 text-amber-100'
                    : 'border-red-500/40 bg-red-950 text-red-100'
              }`}
            >
              <span>{toast.text}</span>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-xs font-semibold opacity-80 hover:opacity-100"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6 lg:py-6">
          {tab === 'bookings' && (
            <BookingsScreen
              openId={openBookingId}
              onOpened={() => setOpenBookingId(null)}
            />
          )}
          {tab === 'calendar' && <CalendarScreen />}
          {tab === 'customers' && (
            <CustomersScreen
              openKey={openCustomerKey}
              onOpened={() => setOpenCustomerKey(null)}
            />
          )}
          {tab === 'quotes' && <QuotesScreen />}
          {tab === 'add' && (
            <AddBookingScreen
              start={bookingStart}
              onStarted={() => setBookingStart(null)}
            />
          )}
        </main>
      </div>
    </AdminContext.Provider>
  );
}
