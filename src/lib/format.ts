export const DEPOSIT_SECURITY_FEE = 100000;

export const PROMO_BANNER_IMAGE = '/src/assets/images/promo_banner_kebaya_1795311172336.jpg';

export const LOCAL_KEBAYA_IMAGES: Record<string, string> = {
  'Akad Nikah': '/src/assets/images/kebaya_akad_ivory_1795311171891.jpg',
  Wisuda: '/src/assets/images/kebaya_wisuda_maroon_1795311172298.jpg',
  Lamaran: '/src/assets/images/kebaya_lamaran_softpink_1795311171109.jpg',
  Kondangan: '/src/assets/images/promo_banner_kebaya_1795311172336.jpg',
};

export function getFallbackKebayaImage(category?: string): string {
  if (category && LOCAL_KEBAYA_IMAGES[category]) {
    return LOCAL_KEBAYA_IMAGES[category];
  }
  return LOCAL_KEBAYA_IMAGES.Wisuda;
}

export function formatIDR(amount: number | string | null | undefined): string {
  const num = Number(amount ?? 0);
  if (Number.isNaN(num)) return 'Rp 0';
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function getTodayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split('T')[0];
}

export function addDaysToISO(startDateISO: string, days: number): string {
  if (!startDateISO) return '';
  const date = new Date(`${startDateISO}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateID(isoDate?: string | null): string {
  if (!isoDate) return '-';
  const parsed = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function getMonthLabelID(isoDate?: string | null): { key: string; label: string } {
  if (!isoDate) return { key: '0000-00', label: 'Lainnya' };
  const parsed = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return { key: '0000-00', label: 'Lainnya' };
  const key = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
  const label = new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: '2-digit',
  }).format(parsed);
  return { key, label };
}

export function generateBookingCode(): string {
  const year = new Date().getFullYear();
  const digits = String(Math.floor(1000 + Math.random() * 9000));
  return `TYR${year}${digits}`;
}

export function normalizePhoneID(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return '';
  if (digits.startsWith('62')) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

export function parseAvailableSizes(kebaya: {
  available_sizes?: string[] | string | null;
  size?: string | null;
}): string[] {
  const dedupe = (list: string[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
      const cleaned = String(raw || '').trim();
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        out.push(cleaned);
      }
    }
    return out;
  };

  if (Array.isArray(kebaya.available_sizes)) {
    const parsed = dedupe(kebaya.available_sizes);
    if (parsed.length > 0) return parsed;
  } else if (typeof kebaya.available_sizes === 'string') {
    const trimmed = kebaya.available_sizes.trim();
    if (trimmed) {
      if (trimmed.startsWith('[')) {
        try {
          const jsonArr = JSON.parse(trimmed);
          if (Array.isArray(jsonArr)) {
            const parsed = dedupe(jsonArr.map(String));
            if (parsed.length > 0) return parsed;
          }
        } catch {
          // fallback to delimiter splitting
        }
      }
      const split = dedupe(trimmed.split(/[,/|;]+/));
      if (split.length > 0) return split;
    }
  }

  if (kebaya.size && typeof kebaya.size === 'string') {
    const fromSize = dedupe(kebaya.size.split(/[,/|;]+/));
    if (fromSize.length > 0) return fromSize;
  }

  return ['All Size'];
}

export function formatAvailableSizesLabel(sizes: string[]): string {
  return sizes.length > 0 ? sizes.join(' / ') : 'All Size';
}

export function resolveBookingItems(booking: {
  items_detail?: Array<{
    kebaya_id: string | number;
    kebaya_name: string;
    category?: string;
    selected_size: string;
    quantity: number;
    price_per_3days: number;
    image_url?: string;
  }> | null;
  kebaya_id: string | number;
  kebaya?: {
    id: string | number;
    name: string;
    category?: string;
    size: string;
    available_sizes?: string[] | string | null;
    price_per_3days: number;
    image_url?: string;
  } | null;
}) {
  if (Array.isArray(booking.items_detail) && booking.items_detail.length > 0) {
    return booking.items_detail;
  }
  const fallbackSizes = booking.kebaya ? parseAvailableSizes(booking.kebaya) : [];
  return [
    {
      kebaya_id: booking.kebaya_id,
      kebaya_name: booking.kebaya?.name || `Kebaya #${booking.kebaya_id}`,
      category: booking.kebaya?.category,
      selected_size: fallbackSizes[0] || booking.kebaya?.size || '-',
      quantity: 1,
      price_per_3days: Number(booking.kebaya?.price_per_3days || 0),
      image_url: booking.kebaya?.image_url,
    },
  ];
}

export function formatBookingItemsSummary(
  booking: Parameters<typeof resolveBookingItems>[0]
): string {
  return resolveBookingItems(booking)
    .map(
      (item) =>
        `${item.quantity}x ${item.kebaya_name} (Size ${item.selected_size})`
    )
    .join(', ');
}

export function resolveBookingPayment(
  booking: {
    grand_total: number;
    dp_amount?: number | null;
    remaining_amount?: number | null;
    payment_scheme?: string | null;
  },
  defaultDpPercent = 50
): {
  grandTotal: number;
  dpAmount: number;
  remainingAmount: number;
  paymentScheme: string;
} {
  const grandTotal = Math.max(0, Number(booking.grand_total || 0));
  if (
    booking.dp_amount !== undefined &&
    booking.dp_amount !== null &&
    booking.remaining_amount !== undefined &&
    booking.remaining_amount !== null
  ) {
    return {
      grandTotal,
      dpAmount: Math.max(0, Number(booking.dp_amount)),
      remainingAmount: Math.max(0, Number(booking.remaining_amount)),
      paymentScheme: booking.payment_scheme || 'DP',
    };
  }

  if (booking.payment_scheme === 'FULL') {
    return {
      grandTotal,
      dpAmount: grandTotal,
      remainingAmount: 0,
      paymentScheme: 'FULL',
    };
  }

  const pct = Math.min(90, Math.max(10, Number(defaultDpPercent || 50)));
  const dpAmount = Math.round((grandTotal * pct) / 100);
  const remainingAmount = Math.max(0, grandTotal - dpAmount);
  return {
    grandTotal,
    dpAmount,
    remainingAmount,
    paymentScheme: 'DP',
  };
}
