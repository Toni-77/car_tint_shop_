// src/components/BookingDrawer.tsx
'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import BookingForm from './BookingForm';

interface BookingDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function BookingDrawer({ isOpen, onClose }: BookingDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <div 
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${
        isOpen ? 'visible' : 'invisible pointer-events-none'
      }`}
    >
      {/* Dark Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-500 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sliding Panel */}
      <div 
        className={`absolute inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl transition-transform duration-500 ease-in-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full bg-white text-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b bg-gray-50/50">
            <div>
              <h2 className="text-xl font-bold">New Appointment</h2>
              <p className="text-sm text-slate-500">Service & Vehicle Details</p>
            </div>
            <button 
              type="button"
              onClick={onClose}
              className="p-2 rounded-full hover:bg-gray-200 transition-colors text-slate-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Scrollable Form Area */}
          <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
            <BookingForm />
          </div>

          {/* Footer / Branding */}
          <div className="p-4 border-t bg-gray-50 text-center">
            <p className="text-xs text-slate-400">© Supernova Tinting Request System</p>
          </div>
        </div>
      </div>
    </div>
  );
}
