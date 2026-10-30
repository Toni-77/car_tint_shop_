'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getBookedSlots, sendManualBookingRequest } from '@/actions/booking';
import {
  FILM_REMOVAL_OPTIONS,
  NOTES_MAX_LENGTH,
  SERVICES,
  TINT_SHADES,
  TINT_WINDOWS,
  VEHICLE_TYPES,
  formatDisplayDate,
  getAvailableTimeSlots,
  normalizeUSPhone,
  openingHoursText,
  shopNow,
  validEmail,
  validNotes,
  validPersonName,
  validVehicleText,
  type Service,
  type VehicleType,
} from '@/lib/booking-rules';

type TintShade = (typeof TINT_SHADES)[number];
type TintWindow = (typeof TINT_WINDOWS)[number];
type FilmRemoval = (typeof FILM_REMOVAL_OPTIONS)[number];

type BookingFormData = {
  vehicleType: VehicleType | '';
  year: string;
  make: string;
  model: string;
  service: Service | '';
  tintShade: TintShade | '';
  tintWindows: TintWindow[];
  filmRemoval: FilmRemoval | '';
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  date: string;
  timeSlot: string;
  notes: string;
};

type SubmittedSummary = {
  name: string;
  vehicle: string;
  service: string;
  date: string;
  time: string;
  email: string;
};

const EMPTY_FORM: BookingFormData = {
  vehicleType: '',
  year: '',
  make: '',
  model: '',
  service: '',
  tintShade: '',
  tintWindows: [],
  filmRemoval: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  date: '',
  timeSlot: '',
  notes: '',
};

const OTHER = 'Other / Not Listed';

// Phone mask: keeps digits only (max 10) and shows them as (312) 555-0123 while typing.
// A pasted number with a leading +1 country code keeps just the 10-digit number.
function formatPhoneInput(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length <= 3) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}
type Body = VehicleType;

// Curated master list of makes customers are likely to bring in (current US brands
// plus common discontinued ones), with the body styles each make has offered.
// To add a make, add one line here; it shows up under every type listed for it.
// Anything missing is still covered by "Other / Not Listed".
const ALL: Body[] = [
  'Sedan',
  'Coupe',
  'Convertible',
  'Hatchback',
  'Wagon',
  'SUV',
];
const MAKES: Record<string, Body[]> = {
  Acura: ['Sedan', 'Coupe', 'Hatchback', 'SUV'],
  'Alfa Romeo': ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  'Aston Martin': ['Coupe', 'Convertible', 'SUV'],
  Audi: ALL,
  Bentley: ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  BMW: ALL,
  Buick: ['Sedan', 'Hatchback', 'Wagon', 'SUV', 'Minivan'],
  Cadillac: ['Sedan', 'Coupe', 'Convertible', 'Wagon', 'SUV', 'Pickup Truck'],
  Chevrolet: [...ALL, 'Minivan', 'Van', 'Pickup Truck'],
  Chrysler: ['Sedan', 'Convertible', 'Wagon', 'Minivan'],
  Dodge: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'Wagon',
    'SUV',
    'Minivan',
    'Van',
  ],
  Ferrari: ['Coupe', 'Convertible', 'SUV'],
  Fiat: ['Hatchback', 'Convertible', 'SUV'],
  Fisker: ['SUV'],
  Ford: [...ALL, 'Minivan', 'Van', 'Pickup Truck'],
  Genesis: ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  GMC: ['SUV', 'Van', 'Pickup Truck'],
  Honda: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'Wagon',
    'SUV',
    'Minivan',
    'Pickup Truck',
  ],
  Hummer: ['SUV', 'Pickup Truck'],
  Hyundai: ['Sedan', 'Coupe', 'Hatchback', 'SUV', 'Minivan', 'Pickup Truck'],
  Infiniti: ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  Jaguar: ['Sedan', 'Coupe', 'Convertible', 'Wagon', 'SUV'],
  Jeep: ['SUV', 'Pickup Truck'],
  Kia: ['Sedan', 'Coupe', 'Hatchback', 'Wagon', 'SUV', 'Minivan'],
  Lamborghini: ['Coupe', 'Convertible', 'SUV'],
  'Land Rover': ['SUV'],
  Lexus: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'Wagon',
    'SUV',
    'Minivan',
  ],
  Lincoln: ['Sedan', 'SUV', 'Pickup Truck'],
  Lotus: ['Coupe', 'Convertible', 'SUV'],
  Lucid: ['Sedan', 'SUV'],
  Maserati: ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  Mazda: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'Wagon',
    'SUV',
    'Minivan',
    'Pickup Truck',
  ],
  McLaren: ['Coupe', 'Convertible'],
  'Mercedes-Benz': [...ALL, 'Minivan', 'Van'],
  Mercury: ['Sedan', 'Coupe', 'Wagon', 'SUV', 'Minivan'],
  Mini: ['Hatchback', 'Convertible', 'Wagon', 'SUV'],
  Mitsubishi: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'SUV',
    'Pickup Truck',
  ],
  Nissan: [...ALL, 'Minivan', 'Van', 'Pickup Truck'],
  Polestar: ['Sedan', 'Hatchback', 'SUV'],
  Pontiac: [
    'Sedan',
    'Coupe',
    'Convertible',
    'Hatchback',
    'Wagon',
    'SUV',
    'Minivan',
  ],
  Porsche: ['Sedan', 'Coupe', 'Convertible', 'Hatchback', 'Wagon', 'SUV'],
  Ram: ['Van', 'Pickup Truck'],
  Rivian: ['SUV', 'Van', 'Pickup Truck'],
  'Rolls-Royce': ['Sedan', 'Coupe', 'Convertible', 'SUV'],
  Saab: ['Sedan', 'Convertible', 'Hatchback', 'Wagon', 'SUV'],
  Saturn: ['Sedan', 'Coupe', 'Convertible', 'Wagon', 'SUV', 'Minivan'],
  Scion: ['Sedan', 'Coupe', 'Hatchback', 'Wagon'],
  Smart: ['Coupe', 'Convertible', 'Hatchback'],
  Subaru: ['Sedan', 'Coupe', 'Hatchback', 'Wagon', 'SUV'],
  Suzuki: ['Sedan', 'Hatchback', 'Wagon', 'SUV', 'Pickup Truck'],
  Tesla: ['Sedan', 'SUV', 'Pickup Truck'],
  Toyota: [...ALL, 'Minivan', 'Van', 'Pickup Truck'],
  VinFast: ['SUV'],
  Volkswagen: [...ALL, 'Minivan', 'Van'],
  Volvo: ['Sedan', 'Coupe', 'Convertible', 'Hatchback', 'Wagon', 'SUV'],
};

const MAKES_BY_VEHICLE_TYPE = Object.fromEntries(
  VEHICLE_TYPES.map((type) => [
    type,
    Object.keys(MAKES)
      .filter((make) => MAKES[make].includes(type))
      .sort((a, b) => a.localeCompare(b)),
  ]),
) as Record<Body, string[]>;

const modelCache = new Map<string, string[]>();

type VpicResponse = {
  Results?: Array<{
    Model_Name?: string;
    ModelName?: string;
    Model?: string;
  }>;
};

/** Answers that can be filled in ahead of time, e.g. from the Get Quote estimator. */
export type BookingPrefill = Partial<
  Pick<
    BookingFormData,
    | 'vehicleType'
    | 'service'
    | 'tintShade'
    | 'tintWindows'
    | 'filmRemoval'
    | 'notes'
  >
> & {
  /** The Get Quote estimate this booking starts from. */
  quoteId?: string;
};

interface BookingFormProps {
  /** Closes the drawer from the "Request sent" screen. */
  onClose?: () => void;
  prefill?: BookingPrefill;
}

export default function BookingForm({ onClose, prefill }: BookingFormProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [vehicleError, setVehicleError] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [formData, setFormData] = useState<BookingFormData>(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { quoteId: _quoteId, ...answers } = prefill ?? {};
    return { ...EMPTY_FORM, ...answers };
  });
  // Kept so the booking is linked to the estimate it came from.
  const quoteId = useRef(prefill?.quoteId);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [submitted, setSubmitted] = useState<SubmittedSummary | null>(null);

  // Spam protection: a hidden field people never see, and when the form was opened.
  const [website, setWebsite] = useState('');
  const startedAt = useRef(Date.now());

  const dateInputRef = useRef<HTMLInputElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

  // Errors show at the top of the form, so bring them into view.
  useEffect(() => {
    if (errorMessage) {
      errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [errorMessage]);

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 32 }, (_, i) => String(currentYear + 1 - i));
  }, []);

  const availableMakes = useMemo(() => {
    if (!formData.vehicleType) return [];
    return [...MAKES_BY_VEHICLE_TYPE[formData.vehicleType], OTHER];
  }, [formData.vehicleType]);

  // Opening hours, Sundays, holidays and lead time are all worked out in Chicago time.
  const availableSlots = useMemo(
    () => getAvailableTimeSlots(formData.date),
    [formData.date],
  );
  const openSlots = availableSlots.filter(
    (slot) => !bookedSlots.includes(slot),
  );
  const minimumDate = shopNow().date;

  const isCustomMake = formData.make === OTHER;
  const isCustomModel = isCustomMake || formData.model === OTHER;
  const isTint = formData.service === 'Window Tint';

  const updateField = <K extends keyof BookingFormData>(
    field: K,
    value: BookingFormData[K],
  ) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
    setErrorMessage('');
  };

  const toggleWindow = (pane: TintWindow) => {
    setFormData((previous) => ({
      ...previous,
      tintWindows: previous.tintWindows.includes(pane)
        ? previous.tintWindows.filter((w) => w !== pane)
        : [...previous.tintWindows, pane],
    }));
    setErrorMessage('');
  };

  // Load the vehicle models for the chosen year and make from NHTSA.
  useEffect(() => {
    if (!formData.year || !formData.make || formData.make === OTHER) {
      setAvailableModels([]);
      setLoadingModels(false);
      setVehicleError('');
      return;
    }
    const controller = new AbortController();
    let active = true;

    async function fetchModels() {
      const key = `${formData.year}|${formData.make}`;
      const cached = modelCache.get(key);
      if (cached) {
        setAvailableModels(cached);
        setVehicleError(
          cached.length
            ? ''
            : 'No models found. Choose Other / Not Listed to enter yours.',
        );
        setLoadingModels(false);
        return;
      }
      setLoadingModels(true);
      setAvailableModels([]);
      setVehicleError('');
      try {
        const url =
          `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/` +
          `make/${encodeURIComponent(formData.make)}/` +
          `modelyear/${encodeURIComponent(formData.year)}?format=json`;
        const response = await fetch(url, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        const data = (await response.json()) as VpicResponse;
        const models = [
          ...new Set(
            (data.Results ?? [])
              .map((item) =>
                (item.Model_Name ?? item.ModelName ?? item.Model ?? '').trim(),
              )
              .filter(Boolean),
          ),
        ].sort((a, b) => a.localeCompare(b));
        if (!active) return;
        modelCache.set(key, models);
        setAvailableModels(models);
        setVehicleError(
          models.length
            ? ''
            : 'No models found. Choose Other / Not Listed to enter yours.',
        );
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
        if (!active) return;
        console.error('Failed to load vehicle models:', error);
        setAvailableModels([]);
        setVehicleError(
          'Could not load models. You can choose Other / Not Listed and enter yours manually.',
        );
      } finally {
        if (active) setLoadingModels(false);
      }
    }

    void fetchModels();
    return () => {
      active = false;
      controller.abort();
    };
  }, [formData.year, formData.make]);

  // Load times already booked on the chosen date so they show as taken.
  const refreshBookedSlots = async (date: string) => {
    if (!date) {
      setBookedSlots([]);
      return;
    }
    setLoadingBooked(true);
    try {
      setBookedSlots(await getBookedSlots(date));
    } catch (error) {
      console.error('Failed to load booked times:', error);
      setBookedSlots([]);
    } finally {
      setLoadingBooked(false);
    }
  };

  useEffect(() => {
    let active = true;
    if (!formData.date) {
      setBookedSlots([]);
      return;
    }
    setLoadingBooked(true);
    getBookedSlots(formData.date)
      .then((slots) => {
        if (active) setBookedSlots(slots);
      })
      .catch((error) => {
        console.error('Failed to load booked times:', error);
        if (active) setBookedSlots([]);
      })
      .finally(() => {
        if (active) setLoadingBooked(false);
      });
    return () => {
      active = false;
    };
  }, [formData.date]);

  const vehicleMake = isCustomMake ? customMake.trim() : formData.make;
  const vehicleModel = isCustomModel ? customModel.trim() : formData.model;

  const validateVehicle = (): boolean => {
    if (
      !formData.vehicleType ||
      !formData.year ||
      !vehicleMake ||
      !vehicleModel ||
      !formData.service
    ) {
      setErrorMessage('Please complete all vehicle and service fields.');
      return false;
    }
    if (!validVehicleText(vehicleMake) || !validVehicleText(vehicleModel)) {
      setErrorMessage(
        'Please remove unsupported characters from the vehicle make or model.',
      );
      return false;
    }
    if (!availableYears.includes(formData.year)) {
      setErrorMessage('Please select a valid vehicle year.');
      return false;
    }
    if (
      isTint &&
      (!formData.tintShade ||
        formData.tintWindows.length === 0 ||
        !formData.filmRemoval)
    ) {
      setErrorMessage(
        'Please choose a tint shade, the windows to tint, and whether old film needs removing.',
      );
      return false;
    }
    return true;
  };

  const validateContact = (): boolean => {
    if (
      !formData.firstName.trim() ||
      !formData.lastName.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim()
    ) {
      setErrorMessage('Please complete all contact information fields.');
      return false;
    }
    if (
      !validPersonName(formData.firstName) ||
      !validPersonName(formData.lastName)
    ) {
      setErrorMessage(
        'Please use valid names. Letters, spaces, apostrophes, and hyphens are allowed.',
      );
      return false;
    }
    if (!validEmail(formData.email)) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }
    if (!normalizeUSPhone(formData.phone)) {
      setErrorMessage('Please enter a valid 10-digit US phone number.');
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setCustomMake('');
    setCustomModel('');
    setAvailableModels([]);
    setVehicleError('');
    setErrorMessage('');
    setBookedSlots([]);
    setWebsite('');
    setSubmitted(null);
    setStep(1);
    startedAt.current = Date.now();
    quoteId.current = undefined;
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    if (!validateVehicle() || !validateContact()) return;
    if (!validNotes(formData.notes)) {
      setErrorMessage(
        'Please remove < > or hidden characters from your notes.',
      );
      return;
    }
    if (!formData.date || !openSlots.includes(formData.timeSlot)) {
      setErrorMessage(
        'Please select a valid appointment date and available time.',
      );
      return;
    }

    // Send the actual typed values, not the "Other / Not Listed" placeholder.
    const submissionData = {
      vehicleType: formData.vehicleType,
      year: formData.year,
      make: vehicleMake,
      model: vehicleModel,
      service: formData.service,
      ...(isTint
        ? {
            tintShade: formData.tintShade,
            tintWindows: formData.tintWindows,
            filmRemoval: formData.filmRemoval,
          }
        : {}),
      firstName: formData.firstName.trim(),
      lastName: formData.lastName.trim(),
      email: formData.email.trim(),
      phone: normalizeUSPhone(formData.phone) ?? formData.phone.trim(),
      date: formData.date,
      timeSlot: formData.timeSlot,
      notes: formData.notes.trim(),
      website,
      elapsedMs: Date.now() - startedAt.current,
      ...(quoteId.current ? { quoteId: quoteId.current } : {}),
    };

    setLoading(true);
    try {
      const result = await sendManualBookingRequest(submissionData);
      if (result?.success) {
        setSubmitted({
          name: submissionData.firstName,
          vehicle: `${formData.year} ${vehicleMake} ${vehicleModel}`,
          service: formData.service,
          date: formatDisplayDate(formData.date),
          time: formData.timeSlot,
          email: submissionData.email,
        });
      } else {
        setErrorMessage(
          (result && 'error' in result && result.error) ||
            'Your request could not be submitted. Please try again.',
        );
        if (result && 'slotTaken' in result && result.slotTaken) {
          // Clear the time without clearing the error message above.
          setFormData((previous) => ({ ...previous, timeSlot: '' }));
          await refreshBookedSlots(formData.date);
        }
      }
    } catch (error) {
      console.error('Booking request failed:', error);
      setErrorMessage(
        'A connection error occurred. Please check your connection and try again.',
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3 text-sm lg:text-base text-white outline-none placeholder:text-slate-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 disabled:cursor-not-allowed disabled:opacity-50';
  const labelClass =
    'mb-1.5 block text-sm lg:text-base font-medium text-slate-200';
  const primaryButton =
    'w-full rounded-xl bg-red-600 px-4 py-3.5 font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300';
  const secondaryButton =
    'w-full rounded-xl border border-slate-600 bg-slate-700 px-4 py-3.5 font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50';
  const chipClass = (selected: boolean) =>
    `rounded-lg border px-3 py-2.5 text-left text-sm lg:text-base font-medium transition ${
      selected
        ? 'border-red-500 bg-red-600/90 text-white'
        : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-red-500 hover:bg-slate-600'
    }`;

  // ---------------------------------------------------------------------------
  // "Request sent" screen
  // ---------------------------------------------------------------------------
  if (submitted) {
    return (
      <div className="space-y-5 py-2 text-center text-white">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 ring-1 ring-emerald-500/40">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-emerald-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div role="status">
          <h3 className="text-xl lg:text-2xl font-bold">
            Request sent, {submitted.name}!
          </h3>
          <p className="mt-2 text-sm lg:text-base leading-6 text-slate-400">
            Your time is held for you. Our team will contact you to confirm your
            appointment.
          </p>
        </div>
        <dl className="space-y-2 rounded-xl border border-slate-700 bg-slate-700/40 p-4 text-left text-sm lg:text-base">
          {(
            [
              ['Vehicle', submitted.vehicle],
              ['Service', submitted.service],
              ['Date', submitted.date],
              ['Time', submitted.time],
              ['Email', submitted.email],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4">
              <dt className="text-slate-400">{label}</dt>
              <dd className="text-right font-medium text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              resetForm();
              onClose?.();
            }}
          >
            Close
          </button>
          <button type="button" className={secondaryButton} onClick={resetForm}>
            Book Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 text-white">
      {/* Hidden from people; bots that fill it in are ignored by the server. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm lg:text-base font-semibold text-slate-200">
            Book an Appointment
          </p>
          <p className="text-xs lg:text-sm text-slate-400">Step {step} of 3</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-600">
          <div
            className="h-full rounded-full bg-red-600 transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      {errorMessage && (
        <p
          ref={errorRef}
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm lg:text-base text-red-200"
        >
          {errorMessage}
        </p>
      )}

      {step === 1 && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg lg:text-xl font-bold">
              1. Vehicle &amp; Service
            </h3>
            <p className="mt-1 text-sm lg:text-base text-slate-400">
              Select your vehicle details and the service you are interested in.
            </p>
          </div>

          <div>
            <label htmlFor="vehicleType" className={labelClass}>
              Vehicle Type
            </label>
            <select
              id="vehicleType"
              className={inputClass}
              value={formData.vehicleType}
              onChange={(e) => {
                setFormData((p) => ({
                  ...p,
                  vehicleType: e.target.value as VehicleType | '',
                  make: '',
                  model: '',
                }));
                setCustomMake('');
                setCustomModel('');
                setAvailableModels([]);
                setVehicleError('');
                setErrorMessage('');
              }}
            >
              <option value="">Select Vehicle Type</option>
              {VEHICLE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="year" className={labelClass}>
                Vehicle Year
              </label>
              <select
                id="year"
                className={inputClass}
                value={formData.year}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    year: e.target.value,
                    make: '',
                    model: '',
                  }));
                  setCustomMake('');
                  setCustomModel('');
                  setAvailableModels([]);
                  setVehicleError('');
                }}
              >
                <option value="">Select Year</option>
                {availableYears.map((year) => (
                  <option key={year}>{year}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="make" className={labelClass}>
                Make
              </label>
              <select
                id="make"
                className={inputClass}
                value={formData.make}
                disabled={!formData.vehicleType || !formData.year}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    make: e.target.value,
                    model: '',
                  }));
                  setCustomMake('');
                  setCustomModel('');
                  setAvailableModels([]);
                  setVehicleError('');
                }}
              >
                <option value="">Select Make</option>
                {availableMakes.map((make) => (
                  <option key={make} value={make}>
                    {make}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {isCustomMake && (
            <div>
              <label htmlFor="customMake" className={labelClass}>
                Enter Your Vehicle Make
              </label>
              <input
                id="customMake"
                className={inputClass}
                value={customMake}
                maxLength={50}
                onChange={(e) => setCustomMake(e.target.value)}
                placeholder="e.g., Lucid"
                autoComplete="off"
              />
            </div>
          )}

          <div>
            <label htmlFor="model" className={labelClass}>
              Model
            </label>
            {isCustomModel ? (
              <input
                id="model"
                className={inputClass}
                value={customModel}
                maxLength={50}
                onChange={(e) => setCustomModel(e.target.value)}
                placeholder="Enter your vehicle model"
                autoComplete="off"
              />
            ) : (
              <select
                id="model"
                className={inputClass}
                value={formData.model}
                disabled={!formData.make || isCustomMake || loadingModels}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, model: e.target.value }));
                  setCustomModel('');
                }}
              >
                <option value="">
                  {loadingModels ? 'Loading models...' : 'Select Model'}
                </option>
                {availableModels.map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
                <option value={OTHER}>{OTHER}</option>
              </select>
            )}
            {loadingModels && (
              <p className="mt-2 text-xs lg:text-sm text-slate-400">
                Loading available models...
              </p>
            )}
            {vehicleError && (
              <p
                role="status"
                className="mt-2 text-xs lg:text-sm text-amber-300"
              >
                {vehicleError}
              </p>
            )}
            <p className="mt-2 text-xs lg:text-sm leading-5 text-slate-400">
              If you cannot find your vehicle make or model, choose “Other / Not
              Listed” and enter it manually.
            </p>
          </div>

          <div>
            <label htmlFor="service" className={labelClass}>
              Service
            </label>
            <select
              id="service"
              className={inputClass}
              value={formData.service}
              onChange={(e) =>
                updateField('service', e.target.value as Service | '')
              }
            >
              <option value="">Select Service</option>
              {SERVICES.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </div>

          {isTint && (
            <div className="space-y-4 rounded-xl border border-slate-700 bg-slate-700/40 p-4">
              <p className="text-sm lg:text-base font-semibold text-slate-100">
                Window Tint Details
              </p>

              <div>
                <label htmlFor="tintShade" className={labelClass}>
                  Tint Shade
                </label>
                <select
                  id="tintShade"
                  className={inputClass}
                  value={formData.tintShade}
                  onChange={(e) =>
                    updateField('tintShade', e.target.value as TintShade | '')
                  }
                >
                  <option value="">Select Shade</option>
                  {TINT_SHADES.map((shade) => (
                    <option key={shade} value={shade}>
                      {shade}
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs lg:text-sm text-slate-400">
                  Lower numbers are darker. We'll make sure your choice follows
                  Illinois tint law.
                </p>
              </div>

              <fieldset>
                <legend className={labelClass}>Windows to Tint</legend>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {TINT_WINDOWS.map((pane) => {
                    const selected = formData.tintWindows.includes(pane);
                    return (
                      <button
                        key={pane}
                        type="button"
                        aria-pressed={selected}
                        className={chipClass(selected)}
                        onClick={() => toggleWindow(pane)}
                      >
                        {selected ? '✓ ' : ''}
                        {pane}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset>
                <legend className={labelClass}>
                  Remove old tint film first?
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {FILM_REMOVAL_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={formData.filmRemoval === option}
                      className={`${chipClass(formData.filmRemoval === option)} text-center`}
                      onClick={() => updateField('filmRemoval', option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          )}

          <button
            type="button"
            className={primaryButton}
            onClick={() => {
              setErrorMessage('');
              if (validateVehicle()) setStep(2);
            }}
            disabled={loadingModels}
          >
            Next: Contact Information
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg lg:text-xl font-bold">
              2. Customer Information
            </h3>
            <p className="mt-1 text-sm lg:text-base leading-6 text-slate-400">
              Please provide accurate contact details so our team can reach you
              about your appointment, answer questions, and confirm service
              availability. Your information will be used to respond to your
              booking request.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className={labelClass}>
                First Name
              </label>
              <input
                id="firstName"
                className={inputClass}
                placeholder="e.g., John"
                autoComplete="given-name"
                maxLength={50}
                value={formData.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="lastName" className={labelClass}>
                Last Name
              </label>
              <input
                id="lastName"
                className={inputClass}
                placeholder="e.g., Smith"
                autoComplete="family-name"
                maxLength={50}
                value={formData.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="email" className={labelClass}>
              Email Address
            </label>
            <input
              id="email"
              type="email"
              className={inputClass}
              placeholder="e.g., john@example.com"
              autoComplete="email"
              maxLength={254}
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            <p className="mt-1.5 text-xs lg:text-sm text-slate-400">
              Please enter a valid email address so we can contact you.
            </p>
          </div>
          <div>
            <label htmlFor="phone" className={labelClass}>
              Phone Number
            </label>
            <input
              id="phone"
              type="tel"
              className={inputClass}
              inputMode="numeric"
              placeholder="(312) 555-0123"
              autoComplete="tel-national"
              maxLength={14}
              value={formData.phone}
              onChange={(e) =>
                updateField('phone', formatPhoneInput(e.target.value))
              }
            />
            <p className="mt-1.5 text-xs lg:text-sm text-slate-400">
              Enter your 10-digit US phone number.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className={secondaryButton}
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryButton} col-span-2`}
              onClick={() => {
                setErrorMessage('');
                if (validateContact()) setStep(3);
              }}
            >
              Next: Pick Appointment
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <div>
            <h3 className="text-lg lg:text-xl font-bold">
              3. Appointment Date &amp; Time
            </h3>
            <p className="mt-1 text-sm lg:text-base leading-6 text-slate-400">
              Choose your preferred date and an available appointment time. This
              is a request; our team will contact you to confirm it.
            </p>
          </div>

          <div>
            <label htmlFor="date" className={labelClass}>
              Preferred Date
            </label>
            <div className="flex gap-2">
              <input
                ref={dateInputRef}
                id="date"
                type="date"
                className={`${inputClass} min-w-0 flex-1`}
                value={formData.date}
                min={minimumDate}
                onChange={(e) => {
                  setFormData((p) => ({
                    ...p,
                    date: e.target.value,
                    timeSlot: '',
                  }));
                  setErrorMessage('');
                }}
              />
              <button
                type="button"
                className="shrink-0 rounded-xl border border-slate-600 bg-slate-600 px-3 text-sm lg:text-base font-semibold text-white hover:bg-slate-500"
                onClick={() => {
                  const input = dateInputRef.current;
                  if (!input) return;
                  try {
                    if (typeof input.showPicker === 'function') {
                      input.showPicker();
                    } else {
                      input.focus();
                      input.click();
                    }
                  } catch {
                    input.focus();
                    input.click();
                  }
                }}
                aria-label="Open appointment calendar"
              >
                Calendar
              </button>
            </div>
            <p className="mt-2 text-xs lg:text-sm leading-5 text-slate-400">
              {openingHoursText()} Closed Sundays and listed holidays. Last
              appointment starts one hour before closing. Times are Chicago
              time.
            </p>
          </div>

          {formData.date && (
            <div className="rounded-xl border border-slate-700 bg-slate-700/40 p-4">
              <p className="text-sm lg:text-base font-semibold text-slate-100">
                {formatDisplayDate(formData.date)}
              </p>
              {!loadingBooked && openSlots.length === 0 && (
                <p className="mt-2 text-sm lg:text-base text-amber-300">
                  {availableSlots.length === 0
                    ? 'We are closed or there are no times left on this date. Please select another date.'
                    : 'This date is fully booked. Please select another date.'}
                </p>
              )}
            </div>
          )}

          <div>
            <p className={labelClass}>Available Times</p>
            {loadingBooked ? (
              <p className="rounded-xl border border-dashed border-slate-600 px-4 py-6 text-center text-sm lg:text-base text-slate-400">
                Checking available times...
              </p>
            ) : availableSlots.length > 0 && openSlots.length > 0 ? (
              <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
                {availableSlots.map((time) => {
                  const taken = bookedSlots.includes(time);
                  const selected = formData.timeSlot === time;
                  return (
                    <button
                      key={time}
                      type="button"
                      disabled={taken}
                      aria-pressed={selected}
                      onClick={() => updateField('timeSlot', time)}
                      className={`rounded-lg border px-2 py-3 text-sm lg:text-base font-medium transition ${
                        taken
                          ? 'cursor-not-allowed border-slate-700 bg-slate-800 text-slate-500 line-through'
                          : selected
                            ? 'border-red-500 bg-red-600 text-white'
                            : 'border-slate-600 bg-slate-700 text-slate-200 hover:border-red-500 hover:bg-slate-600'
                      }`}
                    >
                      {time}
                      {taken && <span className="sr-only"> (booked)</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-slate-600 px-4 py-6 text-center text-sm lg:text-base text-slate-400">
                Select an open date to see available times.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="notes" className={labelClass}>
              Anything else we should know?{' '}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="notes"
              rows={3}
              maxLength={NOTES_MAX_LENGTH}
              className={`${inputClass} resize-y`}
              placeholder="e.g., Questions about shades, a chip in the windshield, or the best time to call"
              value={formData.notes}
              onChange={(e) => updateField('notes', e.target.value)}
            />
            <p className="mt-1 text-right text-xs lg:text-sm text-slate-400">
              {formData.notes.length}/{NOTES_MAX_LENGTH}
            </p>
          </div>

          {formData.date && formData.timeSlot && (
            <div className="space-y-2 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
              <p className="text-sm lg:text-base font-bold">
                Appointment Request Summary
              </p>
              <div className="space-y-1 text-sm lg:text-base text-slate-300">
                <p>
                  Vehicle: {formData.year} {vehicleMake} {vehicleModel}
                </p>
                <p>Service: {formData.service}</p>
                {isTint && (
                  <p>
                    Tint: {formData.tintShade} ·{' '}
                    {formData.tintWindows.join(', ')}
                  </p>
                )}
                <p>Date: {formatDisplayDate(formData.date)}</p>
                <p>Time: {formData.timeSlot}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-slate-700 bg-slate-700/40 p-4">
            <p className="text-sm lg:text-base font-semibold text-slate-200">
              Please Note
            </p>
            <p className="mt-1 text-sm lg:text-base leading-6 text-slate-400">
              Your appointment is a request and is not confirmed until our team
              contacts you. We will follow up using the contact information you
              provided.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              className={secondaryButton}
              disabled={loading}
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              type="button"
              className={`${primaryButton} col-span-2`}
              disabled={
                loading ||
                loadingBooked ||
                !formData.date ||
                !openSlots.includes(formData.timeSlot)
              }
              onClick={handleSubmit}
            >
              {loading ? 'Sending Request...' : 'Submit Request'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
