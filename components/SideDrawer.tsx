'use client';

import { useEffect, useId, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SideDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  footerNote?: string;
  children: ReactNode;
}

/** The sliding panel used by the booking form and the Get Quote estimator. */
export default function SideDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  footerNote,
  children,
}: SideDrawerProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  return (
    <div
      aria-hidden={!isOpen}
      className={`fixed inset-0 z-[9999] transition-all duration-300 ${
        isOpen ? 'visible' : 'invisible pointer-events-none'
      }`}
    >
      {/* Dark, blurred backdrop */}
      <div
        aria-hidden="true"
        className={`absolute inset-0 bg-black/75 backdrop-blur-sm transition-opacity duration-300 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sliding panel */}
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-slate-800 text-white shadow-2xl shadow-black/50 transition-transform duration-300 ease-in-out sm:max-w-lg lg:max-w-xl xl:max-w-[640px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="relative flex shrink-0 items-center justify-between border-b border-white/10 bg-slate-900 px-5 py-5 sm:px-6">
          <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-red-700 via-red-500 to-transparent" />

          <div className="pr-4">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-red-400">
              Supernova Tinting
            </p>
            <h2
              id={titleId}
              className="text-xl font-bold tracking-tight text-white"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-2.5 text-slate-300 transition hover:border-red-500/50 hover:bg-red-500/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-800 p-5 sm:p-7">
          {children}
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-slate-900 px-4 py-3 text-center">
          <p className="text-xs text-slate-400">© Supernova Tinting</p>
          {footerNote && (
            <p className="mt-1 text-xs text-slate-400">{footerNote}</p>
          )}
        </footer>
      </section>
    </div>
  );
}
