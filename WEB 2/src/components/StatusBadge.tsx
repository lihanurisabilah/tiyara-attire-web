import React from 'react';
import { CheckCircle2, Clock, PackageCheck, RotateCcw } from 'lucide-react';
import { BookingStatus } from '../types/database';

interface StatusBadgeProps {
  status: BookingStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status || 'Pending Verification';

  if (normalized === 'Confirmed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-50 text-sky-800 border border-sky-200 whitespace-nowrap shrink-0">
        <CheckCircle2 className="w-3.5 h-3.5 text-sky-600" aria-hidden="true" />
        Confirmed
      </span>
    );
  }

  if (normalized === 'Rented') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-[#F9E4E8] text-[#6B1D2F] border border-[#6B1D2F]/20 whitespace-nowrap shrink-0">
        <PackageCheck className="w-3.5 h-3.5 text-[#6B1D2F]" aria-hidden="true" />
        Rented
      </span>
    );
  }

  if (normalized === 'Returned') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 whitespace-nowrap shrink-0">
        <RotateCcw className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
        Returned
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap shrink-0">
      <Clock className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
      {normalized}
    </span>
  );
};
