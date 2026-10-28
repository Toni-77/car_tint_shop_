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

  // Business Logic for Saturday (9:00 AM - 2:30 PM) and Weekdays (9:00 AM - 4:00 PM)
  const availableSlots = useMemo(() => {
    if (!formData.date) return [];
    
    try {
      const parts = formData.date.split('-');
      if (parts.length !== 3) return [];

      const [year, month, day] = parts.map(Number);
      const date = new Date(year, month - 1, day); 
      
      if (isNaN(date.getTime())) return []; 

      const dayOfWeek = date.getDay(); 
      if (dayOfWeek === 0) return []; // Sunday Closed

      const slots = [];
      
      // Enforce a strict 1-hour cutoff buffer before the doors close
      // Weekdays close at 5 PM -> Last slot allowed is 4:00 PM (Hour 16)
      // Saturdays close at 3:30 PM -> Last slot allowed is 2:30 PM (Hour 14)
      const endHour = (dayOfWeek === 6) ? 14 : 16;
      const endMinute = (dayOfWeek === 6) ? 30 : 0;

      for (let hour = 9; hour <= endHour; hour++) {
        for (let min = 0; min <= 30; min += 30) {
          if (hour === endHour && min > endMinute) break;
          
          const h = hour > 12 ? hour - 12 : hour;
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const time = `${h}:${min === 0 ? '00' : '30'} ${ampm}`;
          slots.push(time);
        }
      }
      return slots;
    } catch (e) {
      console.error("Failed parsing booking slots timeline:", e);
      return [];
    }
  }, [formData.date]);

  const handleFinalSubmit = async () => {
    if (!formData.timeSlot) return alert("Please select a time.");
    
    console.log("Submitting booking request payload details:", formData);
    setLoading(true); 

    try {
      const result = await sendManualBookingRequest(formData);
      
      if (result && result.success) {
        alert("Request Sent! I will contact you shortly to confirm.");
        window.location.reload();
      } else {
        alert("Error processing transaction: " + (result?.error || "Unknown platform exception"));
      }
    } catch (err) {
      console.error("Submission crash caught on UI thread:", err);
      alert("Something went wrong. Please check your network connection.");
    } finally {
      setLoading(false); 
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
            onChange={e => setFormData({...formData, date: e.target.value, timeSlot: ''})} 
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
            )) : <p className="col-span-3 text-center text-gray-400 py-6 text-sm">Please select a valid operating date (Mon-Sat).</p>}
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
