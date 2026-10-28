'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { sendManualBookingRequest } from '@/actions/booking';

type ServiceType =
  | 'Window Tint'
  | 'Ceramic Coating'
  | 'Paint Protection Film'
  | '';

type VehicleType = 'Van' | 'Minivan' | 'Pickup Truck' | 'SUV' | 'Sedan' | '';

// Curated make lists keep the dropdown short and avoid a slow all-makes request.
// The model list is then checked against NHTSA for the selected year and make.
const MAKES_BY_VEHICLE_TYPE: Record<Exclude<VehicleType, ''>, string[]> = {
  Van: ['Chevrolet', 'Ford', 'GMC', 'Mercedes-Benz', 'Nissan', 'Ram', 'Toyota'],
  Minivan: ['Chrysler', 'Honda', 'Kia', 'Toyota', 'Volkswagen'],
  'Pickup Truck': [
    'Chevrolet', 'Ford', 'GMC', 'Honda', 'Jeep', 'Nissan', 'Ram', 'Rivian', 'Toyota',
  ],
  SUV: [
    'Acura', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Dodge', 'Ford',
    'Genesis', 'GMC', 'Honda', 'Hyundai', 'Infiniti', 'Jeep', 'Kia', 'Land Rover',
    'Lexus', 'Lincoln', 'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Subaru',
    'Tesla', 'Toyota', 'Volkswagen', 'Volvo',
  ],
  Sedan: [
    'Acura', 'Alfa Romeo', 'Audi', 'BMW', 'Buick', 'Cadillac', 'Chevrolet', 'Chrysler',
    'Dodge', 'Genesis', 'Honda', 'Hyundai', 'Infiniti', 'Kia', 'Lexus', 'Lincoln',
    'Mazda', 'Mercedes-Benz', 'Mitsubishi', 'Nissan', 'Subaru', 'Tesla', 'Toyota',
    'Volkswagen', 'Volvo',
  ],
};

const modelCache = new Map<string, string[]>();

type VpicModelResult = {
  Model_ID?: number;
  Model_Name?: string;
  ModelId?: number;
  ModelName?: string;
  Model?: string;
};

type VpicResponse<T> = {
  Results?: T[];
  Message?: string;
  Count?: number;
};

export default function BookingForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [availableMakes, setAvailableMakes] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [vehicleError, setVehicleError] = useState('');

  const [formData, setFormData] = useState({
    vehicleType: '' as VehicleType,
    year: '',
    make: '',
    model: '',
    service: '' as ServiceType,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    date: '',
    timeSlot: '',
  });

  // Show next year through the previous 30 years.
  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return Array.from({ length: 32 }, (_, index) =>
      String(currentYear + 1 - index),
    );
  }, []);

  // Populate makes immediately from the selected vehicle category.
  // This removes the slow all-makes network request entirely.
  useEffect(() => {
    if (!formData.vehicleType) {
      setAvailableMakes([]);
      setAvailableModels([]);
      setVehicleError('');
      return;
    }

    setAvailableMakes(MAKES_BY_VEHICLE_TYPE[formData.vehicleType]);
    setAvailableModels([]);
    setVehicleError('');
  }, [formData.vehicleType]);

  // Load models for the selected year and make.
  useEffect(() => {
    if (!formData.year || !formData.make) {
      setAvailableModels([]);
      return;
    }

    const controller = new AbortController();

    async function fetchModels() {
      setLoadingModels(true);
      setAvailableModels([]);
      setVehicleError('');
      const cacheKey = `${formData.year}|${formData.make}`;

      try {
        const cachedModels = modelCache.get(cacheKey);
        if (cachedModels) {
          setAvailableModels(cachedModels);
          if (cachedModels.length === 0) {
            setVehicleError('No models were returned for this year and make. Try another make or contact us to book manually.');
          }
          return;
        }

        const response = await fetch(
          `https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/${encodeURIComponent(formData.make)}/modelyear/${encodeURIComponent(formData.year)}?format=json`,
          { signal: controller.signal, headers: { Accept: 'application/json' } },
        );

        if (!response.ok) {
          throw new Error(`Models request failed (${response.status})`);
        }

        const data = (await response.json()) as VpicResponse<VpicModelResult>;
        const results = data.Results ?? [];

        const models = results
          .map((item) => (item.Model_Name ?? item.ModelName ?? item.Model ?? '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b));

        const uniqueModels = [...new Set(models)];
        modelCache.set(cacheKey, uniqueModels);
        setAvailableModels(uniqueModels);

        if (uniqueModels.length === 0) {
          setVehicleError(
            'No models were returned for this year and make. Try another make or contact us to book manually.',
          );
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;

        console.error('Failed to fetch vehicle models:', error);
        setAvailableModels([]);
        setVehicleError(
          'Could not load vehicle models. Please select the make again.',
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoadingModels(false);
        }
      }
    }

    fetchModels();

    return () => controller.abort();
  }, [formData.year, formData.make]);

  const availableSlots = useMemo(() => {
    if (!formData.date) return [];

    const observedHolidays = new Set([
      '2026-01-01',
      '2026-05-25',
      '2026-07-04',
      '2026-09-07',
      '2026-11-26',
      '2026-12-25',
      '2027-01-01',
    ]);

    if (observedHolidays.has(formData.date)) return [];

    const parts = formData.date.split('-');
    if (parts.length !== 3) return [];

    const [year, month, day] = parts.map(Number);
    const date = new Date(year, month - 1, day);

    if (Number.isNaN(date.getTime())) return [];

    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) return []; // Closed Sundays.

    const slots: string[] = [];
    const endHour = dayOfWeek === 6 ? 14 : 16;
    const endMinute = dayOfWeek === 6 ? 30 : 0;

    for (let hour = 9; hour <= endHour; hour++) {
      for (let minute = 0; minute <= 30; minute += 30) {
        if (hour === endHour && minute > endMinute) break;

        const displayHour = hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        slots.push(
          `${displayHour}:${minute === 0 ? '00' : '30'} ${ampm}`,
        );
      }
    }

    return slots;
  }, [formData.date]);

  const updateFormData = (
    field: keyof typeof formData,
    value: string,
  ) => {
    setFormData((previous) => ({ ...previous, [field]: value }));
  };

  const handleFinalSubmit = async () => {
    if (!formData.timeSlot) {
      alert('Please select an appointment time slot.');
      return;
    }

    setLoading(true);

    try {
      const result = await sendManualBookingRequest(formData);

      if (result?.success) {
        alert(
          'Booking request submitted! We will reach out shortly to confirm.',
        );
        window.location.reload();
      } else {
        alert(
          `Booking request failed: ${result?.error || 'Unknown error'}`,
        );
      }
    } catch (error) {
      console.error('Booking request failed:', error);
      alert('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-100 bg-white p-6 text-slate-900 shadow-sm">
      {step === 1 && (
        <div className="animate-in fade-in duration-300 space-y-3">
          <h3 className="border-b pb-1 text-lg font-bold">
            1. Vehicle &amp; Service
          </h3>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Vehicle Type</span>
            <select
              className="w-full rounded-lg border bg-white p-3 text-sm"
              value={formData.vehicleType}
              onChange={(event) => {
                const vehicleType = event.target.value as VehicleType;
                setFormData((previous) => ({
                  ...previous,
                  vehicleType,
                  make: '',
                  model: '',
                }));
                setAvailableMakes(vehicleType ? MAKES_BY_VEHICLE_TYPE[vehicleType] : []);
                setAvailableModels([]);
                setVehicleError('');
              }}
            >
              <option value="">Select Vehicle Type</option>
              <option value="Van">Van</option>
              <option value="Minivan">Minivan</option>
              <option value="Pickup Truck">Pickup Truck</option>
              <option value="SUV">SUV</option>
              <option value="Sedan">Sedan</option>
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Year</span>
            <select
              className="w-full rounded-lg border bg-white p-3 text-sm"
              value={formData.year}
              onChange={(event) => {
                const year = event.target.value;
                setFormData((previous) => ({
                  ...previous,
                  year,
                  make: '',
                  model: '',
                }));
                setAvailableModels([]);
                setVehicleError('');
              }}
            >
              <option value="">Select Year</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Make</span>
            <select
              className="w-full rounded-lg border bg-white p-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              value={formData.make}
              disabled={!formData.vehicleType || !formData.year}
              onChange={(event) => {
                const make = event.target.value;
                setFormData((previous) => ({
                  ...previous,
                  make,
                  model: '',
                }));
                setAvailableModels([]);
              }}
            >
              <option value="">
                {!formData.vehicleType
                  ? 'Choose a vehicle type first'
                  : formData.year
                    ? 'Select Make'
                    : 'Choose a year first'}
              </option>
              {availableMakes.map((make) => (
                <option key={make} value={make}>
                  {make}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Model</span>
            <select
              className="w-full rounded-lg border bg-white p-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              value={formData.model}
              disabled={!formData.make || loadingModels}
              onChange={(event) => updateFormData('model', event.target.value)}
            >
              <option value="">
                {loadingModels
                  ? 'Loading models...'
                  : formData.make
                    ? 'Select Model'
                    : 'Choose a make first'}
              </option>
              {availableModels.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </label>

          {vehicleError && (
            <p role="alert" className="text-sm text-red-600">
              {vehicleError}
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-sm font-medium">Service</span>
            <select
              className="w-full rounded-lg border bg-white p-3 text-sm"
              value={formData.service}
              onChange={(event) =>
                updateFormData('service', event.target.value as ServiceType)
              }
            >
              <option value="">Select Service</option>
              <option value="Window Tint">Window Tint</option>
              <option value="Ceramic Coating">Ceramic Coating</option>
              <option value="Paint Protection Film">
                Paint Protection Film
              </option>
            </select>
          </label>

          <button
            type="button"
            disabled={
              !formData.vehicleType ||
              !formData.year ||
              !formData.make ||
              !formData.model ||
              !formData.service ||
              loadingModels
              }
            onClick={() => setStep(2)}
            className="w-full rounded-xl bg-blue-600 p-4 font-bold text-white transition-colors disabled:bg-gray-300"
          >
            Next: Contact Info
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="animate-in fade-in duration-300 space-y-3">
          <h3 className="border-b pb-1 text-lg font-bold">2. Contact Info</h3>

          <div className="grid grid-cols-2 gap-2">
            <input
              className="w-full rounded-lg border bg-gray-50 p-3 text-sm"
              placeholder="First Name"
              autoComplete="given-name"
              value={formData.firstName}
              onChange={(event) =>
                updateFormData('firstName', event.target.value)
              }
            />
            <input
              className="w-full rounded-lg border bg-gray-50 p-3 text-sm"
              placeholder="Last Name"
              autoComplete="family-name"
              value={formData.lastName}
              onChange={(event) =>
                updateFormData('lastName', event.target.value)
              }
            />
          </div>

          <input
            type="email"
            className="w-full rounded-lg border bg-gray-50 p-3 text-sm"
            placeholder="Email"
            autoComplete="email"
            value={formData.email}
            onChange={(event) => updateFormData('email', event.target.value)}
          />

          <input
            type="tel"
            className="w-full rounded-lg border bg-gray-50 p-3 text-sm"
            placeholder="Phone"
            autoComplete="tel"
            value={formData.phone}
            onChange={(event) => updateFormData('phone', event.target.value)}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-1/3 rounded-xl bg-gray-100 p-4 text-sm font-medium"
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                !formData.firstName.trim() ||
                !formData.lastName.trim() ||
                !formData.phone.trim() ||
                !formData.email.trim()
              }
              onClick={() => setStep(3)}
              className="w-2/3 rounded-xl bg-blue-600 p-4 font-bold text-white transition-colors disabled:bg-gray-300"
            >
              Next: Pick Time
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="animate-in fade-in duration-300 space-y-3">
          <h3 className="border-b pb-1 text-lg font-bold">3. Desired Time</h3>

          <input
            type="date"
            min={new Date().toLocaleDateString('en-CA')}
            className="w-full rounded-lg border bg-gray-50 p-3 text-sm"
            value={formData.date}
            onChange={(event) => {
              setFormData((previous) => ({
                ...previous,
                date: event.target.value,
                timeSlot: '',
              }));
            }}
          />

          <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto p-1">
            {availableSlots.length > 0 ? (
              availableSlots.map((time) => (
                <button
                  key={time}
                  type="button"
                  onClick={() => updateFormData('timeSlot', time)}
                  className={`rounded-lg border p-2 text-xs transition-colors ${
                    formData.timeSlot === time
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'bg-white text-slate-600 hover:bg-blue-50'
                  }`}
                >
                  {time}
                </button>
              ))
            ) : (
              <p className="col-span-3 py-6 text-center text-sm text-gray-400">
                Please select a valid operating date (Monday–Saturday,
                excluding holidays).
              </p>
            )}
          </div>

          <div className="flex gap-2 border-t pt-4">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="w-1/3 rounded-xl bg-gray-100 p-4 text-sm font-medium"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={!formData.timeSlot || loading}
              className="w-2/3 rounded-xl bg-green-600 p-4 font-bold text-white disabled:bg-gray-300"
            >
              {loading ? 'Sending...' : 'Send Request'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}