'use client';
import React, { useState, useMemo } from 'react';
import { sendManualBookingRequest } from "@/actions/booking";

type ServiceType = 'Window Tint' | 'Ceramic Coating' | 'Paint Protection Film' | '';

export default function BookingForm() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    year: '', make: '', model: '', service: '' as ServiceType,
    firstName: '', lastName: '', email: '', phone: '',
    date: '', timeSlot: ''
  });

  // Business Logic for Saturday (9-3:30) and Weekdays (9-5)
  const availableSlots = useMemo(() => {
    if (!formData.date) return [];
    
    const [year, month, day] = formData.date.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay(); 
    
    if (dayOfWeek === 0) return []; // Sunday Closed

    const slots = [];
    const endHour = (dayOfWeek === 6) ? 15 : 17;
    const endMinute = (dayOfWeek === 6) ? 30 : 0;

    for (let hour = 9; hour <= endHour; hour++) {
      for (let min of [0, 30]) {
        if (hour === endHour && min > endMinute) break;
        const h = hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const time = `${h}:${min === 0 ? '00' : '30'} ${ampm}`;
        slots.push(time);
      }
    }
    return slots;
  }, [formData.date]);

  const handleFinalSubmit = async () => {
    if (!formData.timeSlot) return alert("Please select a time.");
    
    setLoading(true); // Button enters "Sending..."

    try {
      // This single call handles both Firestore save and Resend email
      const result = await sendManualBookingRequest(formData);
      
      if (result.success) {
        alert("Request Sent! I will contact you shortly to confirm.");
        window.location.reload();
      } else {
        alert("Error: " + result.error);
      }
    } catch (err) {
      console.error("Submission crash:", err);
      alert("Something went wrong. Please check your connection.");
    } finally {
      setLoading(false); // ALWAYS unlocks the button
    }
  };

  return (
    <div className="space-y-4 text-slate-900 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      {/* STEP 1: VEHICLE & SERVICE */}
      {step === 1 && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <h3 className="font-bold text-lg border-b pb-1">1. Vehicle & Service</h3>
          <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Year" value={formData.year} onChange={e => setFormData({...formData, year: e.target.value})} />
          <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Make" value={formData.make} onChange={e => setFormData({...formData, make: e.target.value})} />
          <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Model" value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} />
          <select className="w-full p-3 border rounded-lg bg-gray-50" value={formData.service} onChange={e => setFormData({...formData, service: e.target.value as ServiceType})}>
            <option value="">Select Service</option>
            <option value="Window Tint">Window Tint</option>
            <option value="Ceramic Coating">Ceramic Coating</option>
            <option value="Paint Protection Film">Paint Protection Film</option>
          </select>
          <button 
            disabled={!formData.service || !formData.model} 
            onClick={() => setStep(2)} 
            className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold disabled:bg-gray-300"
          >
            Next: Contact Info
          </button>
        </div>
      )}

      {/* STEP 2: CONTACT INFO */}
      {step === 2 && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <h3 className="font-bold text-lg border-b pb-1">2. Contact Info</h3>
          <div className="grid grid-cols-2 gap-2">
            <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
            <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
          </div>
          <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
          <input className="w-full p-3 border rounded-lg bg-gray-50" placeholder="Phone" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="w-1/3 bg-gray-100 p-4 rounded-xl">Back</button>
            <button 
              disabled={!formData.firstName || !formData.phone} 
              onClick={() => setStep(3)} 
              className="w-2/3 bg-blue-600 text-white p-4 rounded-xl font-bold"
            >
              Next: Pick Time
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: TIME */}
      {step === 3 && (
        <div className="space-y-3 animate-in fade-in duration-300">
          <h3 className="font-bold text-lg border-b pb-1">3. Desired Time</h3>
          <input 
            type="date" 
            min={new Date().toISOString().split('T')[0]} 
            className="w-full p-3 border rounded-lg bg-gray-50" 
            value={formData.date}
            onChange={e => setFormData({...formData, date: e.target.value})} 
          />
          
          <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
            {availableSlots.length > 0 ? availableSlots.map(time => (
              <button 
                key={time} 
                type="button"
                onClick={() => setFormData({...formData, timeSlot: time})} 
                className={`p-2 text-xs border rounded-lg transition-colors ${
                  formData.timeSlot === time ? 'bg-blue-600 text-white border-blue-600' : 'bg-white hover:bg-blue-50 text-slate-600'
                }`}
              >
                {time}
              </button>
            )) : <p className="col-span-3 text-center text-gray-400 py-6 text-sm">Please select a date (Mon-Sat).</p>}
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <button onClick={() => setStep(2)} className="w-1/3 bg-gray-100 p-4 rounded-xl">Back</button>
            <button 
              onClick={handleFinalSubmit} 
              disabled={!formData.timeSlot || loading} 
              className="w-2/3 bg-green-600 text-white p-4 rounded-xl font-bold disabled:bg-gray-300"
            >
              {loading ? "Sending..." : "Send Request"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
