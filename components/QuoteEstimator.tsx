'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Phone } from 'lucide-react';
import { emailMeQuote, saveQuoteEstimate } from '@/actions/quotes';
import {
  SERVICES,
  VEHICLE_TYPES,
  type Service,
  type VehicleType,
} from '@/lib/booking-rules';
import {
  COATING_NOTE,
  COATING_PACKAGES,
  COATING_PACKAGE_DESCRIPTIONS,
  COATING_PRICES,
  PPF_PACKAGES,
  PPF_PACKAGE_DESCRIPTIONS,
  PPF_PRICES,
  TINT_ADD_ONS,
  TINT_COVERAGE,
  TINT_FILMS,
  TINT_FILM_DESCRIPTIONS,
  TINT_PRICES,
  describeSelection,
  estimatePrice,
  formatPriceRange,
  tintWindowsFor,
  vehicleSize,
  type CoatingPackage,
  type PpfPackage,
  type QuoteSelection,
  type TintAddOnId,
  type TintCoverage,
  type TintFilm,
  type VehicleSize,
} from '@/lib/pricing';
import type { BookingPrefill } from './BookingForm';

const SHOP_PHONE = '773-800-4411';

interface QuoteEstimatorProps {
  /** Opens the booking form with these answers already filled in. */
  onBook: (prefill: BookingPrefill) => void;
}

/** Lowest price for each service at this vehicle size, for the "from $X" labels. */
function startingPrice(service: Service, size: VehicleSize): number {
  const lows =
    service === 'Window Tint'
      ? TINT_COVERAGE.flatMap((c) =>
          TINT_FILMS.map((f) => TINT_PRICES[c][f][size][0]),
        )
      : service === 'Ceramic Coating'
        ? COATING_PACKAGES.map((p) => COATING_PRICES[p][size][0])
        : PPF_PACKAGES.map((p) => PPF_PRICES[p][size][0]);
  return Math.min(...lows);
}

export default function QuoteEstimator({ onBook }: QuoteEstimatorProps) {
  const [vehicleType, setVehicleType] = useState<VehicleType | ''>('');
  const [service, setService] = useState<Service | ''>('');
  const [film, setFilm] = useState<TintFilm>('Ceramic');
  const [coverage, setCoverage] = useState<TintCoverage>('Sides & rear');
  const [addOns, setAddOns] = useState<TintAddOnId[]>([]);
  const [removeOldTint, setRemoveOldTint] = useState(false);
  const [coatingPackage, setCoatingPackage] = useState<CoatingPackage>(
    COATING_PACKAGES[0],
  );
  const [ppfPackage, setPpfPackage] = useState<PpfPackage>('Full front');

  const size = vehicleType ? vehicleSize(vehicleType) : 'standard';

  const selection: QuoteSelection | null = useMemo(() => {
    if (!vehicleType || !service) return null;
    if (service === 'Window Tint') {
      return { service, vehicleType, film, coverage, addOns, removeOldTint };
    }
    if (service === 'Ceramic Coating')
      return { service, vehicleType, coatingPackage };
    return { service, vehicleType, ppfPackage };
  }, [
    vehicleType,
    service,
    film,
    coverage,
    addOns,
    removeOldTint,
    coatingPackage,
    ppfPackage,
  ]);

  const estimate = selection
    ? formatPriceRange(estimatePrice(selection))
    : null;

  // A short description of the choices, saved with the booking request.
  const summary = useMemo(
    () => (selection ? describeSelection(selection) : ''),
    [selection],
  );

  // Every estimate is saved for the shop (no personal details), a few seconds
  // after the visitor stops changing options. Later changes update the same record.
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const quoteIdRef = useRef<string | null>(null);
  const openedAt = useRef(Date.now());
  const sentRef = useRef(false); // true once this estimate was emailed
  const save = async (current: QuoteSelection) => {
    if (sentRef.current) return quoteIdRef.current;
    const result = await saveQuoteEstimate(current, quoteIdRef.current);
    if (result.ok) {
      quoteIdRef.current = result.quoteId;
      setQuoteId(result.quoteId);
    }
    return result.ok ? result.quoteId : null;
  };
  // "Email me this quote"
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // hidden field bots fill in
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent'>(
    'idle',
  );
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState('');
  useEffect(() => {
    // Changing options after sending starts a fresh quote.
    if (emailState === 'sent') {
      sentRef.current = false;
      setEmailState('idle');
      quoteIdRef.current = null;
      setQuoteId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  useEffect(() => {
    if (!selection) return;
    const timer = setTimeout(() => void save(selection), 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const sendQuote = async () => {
    if (!selection) return;
    setEmailError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailState('sending');
    const result = await emailMeQuote({
      selection,
      quoteId: quoteIdRef.current,
      email,
      website,
      elapsedMs: Date.now() - openedAt.current,
    });
    if (!result.ok) {
      setEmailState('idle');
      setEmailError(result.error);
      return;
    }
    quoteIdRef.current = result.quoteId;
    setQuoteId(result.quoteId);
    setEmailSent(result.emailSent);
    sentRef.current = true;
    setEmailState('sent');
  };

  const toggleAddOn = (id: TintAddOnId) =>
    setAddOns((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    );

  const handleBook = async () => {
    if (!selection || !estimate) return;
    // Link the booking to this estimate (save it now if it hasn't been yet).
    const linkedQuote = quoteIdRef.current ?? (await save(selection));
    const prefill: BookingPrefill = {
      ...(linkedQuote ? { quoteId: linkedQuote } : {}),
      vehicleType: selection.vehicleType,
      service: selection.service,
      notes: `Website estimate: ${selection.service} - ${summary} (${estimate})`,
    };
    if (selection.service === 'Window Tint') {
      prefill.tintWindows = tintWindowsFor(
        selection,
      ) as BookingPrefill['tintWindows'];
      prefill.filmRemoval = selection.removeOldTint ? 'Yes' : 'No';
    }
    onBook(prefill);
  };

  const inputClass =
    'w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm text-white outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 lg:text-base';
  const labelClass =
    'mb-1.5 block text-sm font-medium text-slate-200 lg:text-base';
  const optionClass = (selected: boolean) =>
    `w-full rounded-xl border p-3 text-left transition ${
      selected
        ? 'border-red-500 bg-red-600/15 ring-1 ring-red-500'
        : 'border-slate-600 bg-slate-700 hover:border-red-500/70 hover:bg-slate-600'
    }`;
  const chipClass = (selected: boolean) =>
    `rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition lg:text-base ${
      selected
        ? 'border-red-500 bg-red-600/90 text-white'
        : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-red-500 hover:bg-slate-600'
    }`;

  return (
    <div className="space-y-6 text-white">
      <div>
        <h3 className="text-lg font-bold lg:text-xl">
          Get an Instant Estimate
        </h3>
        <p className="mt-1 text-sm leading-6 text-slate-400 lg:text-base">
          Pick your vehicle and service to see an estimated price. No contact
          details needed.
        </p>
      </div>

      <div>
        <label htmlFor="quoteVehicleType" className={labelClass}>
          Vehicle Type
        </label>
        <select
          id="quoteVehicleType"
          className={inputClass}
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType | '')}
        >
          <option value="">Select Vehicle Type</option>
          {VEHICLE_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className={labelClass}>Service</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {SERVICES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={service === option}
              className={optionClass(service === option)}
              onClick={() => setService(option)}
            >
              <span className="block text-sm font-semibold lg:text-base">
                {option}
              </span>
              <span className="mt-0.5 block text-xs text-slate-400 lg:text-sm">
                from{' '}
                {formatPriceRange([
                  startingPrice(option, size),
                  startingPrice(option, size),
                ])}
              </span>
            </button>
          ))}
        </div>
      </fieldset>

      {service === 'Window Tint' && (
        <div className="space-y-5">
          <fieldset>
            <legend className={labelClass}>Film</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TINT_FILMS.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={film === option}
                  className={optionClass(film === option)}
                  onClick={() => setFilm(option)}
                >
                  <span className="block text-sm font-semibold lg:text-base">
                    {option}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400 lg:text-sm">
                    {TINT_FILM_DESCRIPTIONS[option]}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Windows</legend>
            <div className="grid grid-cols-2 gap-2">
              {TINT_COVERAGE.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={coverage === option}
                  className={chipClass(coverage === option)}
                  onClick={() => setCoverage(option)}
                >
                  {option}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className={labelClass}>Add-ons</legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {TINT_ADD_ONS.map((addOn) => {
                const selected = addOns.includes(addOn.id);
                return (
                  <button
                    key={addOn.id}
                    type="button"
                    aria-pressed={selected}
                    className={chipClass(selected)}
                    onClick={() => toggleAddOn(addOn.id)}
                  >
                    {selected ? '✓ ' : '+ '}
                    {addOn.label}
                  </button>
                );
              })}
              <button
                type="button"
                aria-pressed={removeOldTint}
                className={chipClass(removeOldTint)}
                onClick={() => setRemoveOldTint((value) => !value)}
              >
                {removeOldTint ? '✓ ' : '+ '}Remove old tint
              </button>
            </div>
          </fieldset>
        </div>
      )}

      {service === 'Ceramic Coating' && (
        <fieldset>
          <legend className={labelClass}>Package</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {COATING_PACKAGES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={coatingPackage === option}
                className={optionClass(coatingPackage === option)}
                onClick={() => setCoatingPackage(option)}
              >
                <span className="block text-sm font-semibold lg:text-base">
                  {option}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-400 lg:text-sm">
                  {COATING_PACKAGE_DESCRIPTIONS[option]}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-400 lg:text-sm">
            {COATING_NOTE}
          </p>
        </fieldset>
      )}

      {service === 'Paint Protection Film' && (
        <fieldset>
          <legend className={labelClass}>Coverage</legend>
          <div className="grid grid-cols-1 gap-2">
            {PPF_PACKAGES.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={ppfPackage === option}
                className={optionClass(ppfPackage === option)}
                onClick={() => setPpfPackage(option)}
              >
                <span className="block text-sm font-semibold lg:text-base">
                  {option}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-400 lg:text-sm">
                  {PPF_PACKAGE_DESCRIPTIONS[option]}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <p className="text-xs leading-5 text-slate-400 lg:text-sm">
        This is an estimate. Your final price depends on your exact vehicle,
        film and the condition of your glass or paint, and we&apos;ll confirm it
        before any work starts.
      </p>

      {/* On desktop the price and buttons stay pinned at the bottom while choosing. */}
      <div className="space-y-3 lg:sticky lg:bottom-0 lg:-mx-7 lg:-mb-7 lg:border-t lg:border-white/10 lg:bg-slate-800/95 lg:px-7 lg:pb-1 lg:pt-4 lg:backdrop-blur">
        <div
          aria-live="polite"
          className="rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-600/20 to-slate-700/40 p-5 text-center"
        >
          {estimate ? (
            <>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-300 lg:text-sm">
                Estimated price
              </p>
              <p className="mt-1 text-3xl font-extrabold tracking-tight lg:text-4xl">
                {estimate}
              </p>
              <p className="mt-1 text-sm text-slate-300 lg:text-base">
                {vehicleType} · {service}
              </p>
              <p className="text-xs text-slate-400 lg:text-sm">{summary}</p>
            </>
          ) : (
            <p className="py-3 text-sm text-slate-300 lg:text-base">
              {vehicleType
                ? 'Choose a service to see your estimate.'
                : 'Choose your vehicle type and a service to see your estimate.'}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          <button
            type="button"
            disabled={!estimate}
            onClick={handleBook}
            className="rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300 sm:col-span-3"
          >
            Book This Service
          </button>
          <a
            href={`tel:${SHOP_PHONE}`}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 font-semibold text-slate-200 hover:bg-slate-600 sm:col-span-2"
          >
            <Phone className="h-4 w-4 text-red-400" />
            {SHOP_PHONE}
          </a>
        </div>
        {estimate && (
          <div className="space-y-2 rounded-xl border border-slate-600 bg-slate-700/40 p-3">
            {/* Hidden from people; bots that fill it in are ignored. */}
            <input
              aria-hidden="true"
              tabIndex={-1}
              autoComplete="off"
              className="absolute -left-[9999px] h-px w-px"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
            {emailState === 'sent' ? (
              <p
                role="status"
                className="text-sm text-emerald-200 lg:text-base"
              >
                {emailSent
                  ? `Sent! Check your inbox at ${email.trim()} for your estimate.`
                  : `Thanks! We've saved your estimate and will email you at ${email.trim()} shortly.`}
              </p>
            ) : (
              <>
                <label
                  htmlFor="quoteEmail"
                  className="flex items-center gap-2 text-sm font-semibold text-slate-100 lg:text-base"
                >
                  <Mail className="h-4 w-4 text-red-400" /> Email me this quote
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    id="quoteEmail"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className={`${inputClass} !py-2.5 sm:flex-1`}
                    value={email}
                    maxLength={254}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError('');
                    }}
                  />
                  <button
                    type="button"
                    onClick={sendQuote}
                    disabled={emailState === 'sending'}
                    className="rounded-xl border border-slate-500 bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-500 disabled:opacity-50 lg:text-base"
                  >
                    {emailState === 'sending' ? 'Sending...' : 'Send'}
                  </button>
                </div>
                {emailError && (
                  <p role="alert" className="text-sm text-red-300">
                    {emailError}
                  </p>
                )}
                <p className="text-xs text-slate-400 lg:text-sm">
                  We&apos;ll email you this estimate and may follow up about it.
                  No spam.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
