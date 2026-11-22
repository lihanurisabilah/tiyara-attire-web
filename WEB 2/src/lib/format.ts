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
