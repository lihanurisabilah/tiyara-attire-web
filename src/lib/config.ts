import { BookingWithDetails } from '../types/database';
import {
  formatDateID,
  formatIDR,
  resolveBookingItems,
  resolveBookingPayment,
} from './format';

/**
 * Nomor WhatsApp default fallback jika menu Kontak belum diisi.
 */
export const ADMIN_WHATSAPP_NUMBER = '6281188902026';

/**
 * Membersihkan & mengubah nomor WhatsApp dari berbagai format
 * (mis. "0812-3456-7890", "+62 812-3456-7890", "62 0812...")
 * menjadi format internasional tanpa tanda "+", spasi, atau strip (mis. "6281234567890").
 */
export function formatWhatsAppInternational(
  rawNumber?: string | null,
  fallback: string = ADMIN_WHATSAPP_NUMBER
): string {
  const digits = String(rawNumber || '').replace(/[^\d]/g, '');
  if (!digits || digits.length < 8) {
    return fallback;
  }
  if (digits.startsWith('620')) {
    return `62${digits.slice(3)}`;
  }
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  if (digits.startsWith('8')) {
    return `62${digits}`;
  }
  return digits;
}

export function buildBookingWhatsAppMessage(
  booking: BookingWithDetails,
  defaultDpPercent = 50
): string {
  const cleanCode = String(booking.booking_code || '').replace(/-/g, '');
  const items = resolveBookingItems(booking);
  const kebayaLines = items
    .map(
      (item, idx) =>
        `  ${idx + 1}. ${item.quantity}x ${item.kebaya_name} (Size: ${item.selected_size})`
    )
    .join('\n');

  const customerAddress =
    booking.customer_address || booking.delivery_address || '-';

  const pickupDetails = booking.pickup_location
    ? `${booking.pickup_location.name} (${booking.pickup_location.address})`
    : 'Butik Tiyara Attire';

  const payment = resolveBookingPayment(booking, defaultDpPercent);
  const isFullPayment =
    payment.paymentScheme === 'FULL' || payment.remainingAmount === 0;

  return [
    '*NOTIFIKASI PESANAN BARU - TIYARA ATTIRE*',
    '',
    `Kode Booking: ${cleanCode}`,
    `Nama Penyewa: ${booking.customer_name}`,
    `No. Telepon / WA Penyewa: ${booking.customer_phone}`,
    `Alamat Lengkap Penyewa: ${customerAddress}`,
    'Daftar Kebaya & Size Terpilih:',
    kebayaLines,
    `Tanggal Mulai & Selesai Sewa: ${formatDateID(booking.start_date)} s/d ${formatDateID(booking.end_date)} (${booking.duration_days} Hari)`,
    `Cabang Pengambilan: Pickup Store - ${pickupDetails}`,
    `Total Biaya Sewa: ${formatIDR(payment.grandTotal)} (Subtotal ${formatIDR(booking.subtotal)} + Deposit ${formatIDR(booking.deposit_security)})`,
    `Skema Pembayaran: ${isFullPayment ? 'Bayar Langsung' : `Bayar DP (${defaultDpPercent}%)`}`,
    `Nominal Dibayar Sekarang: ${formatIDR(payment.dpAmount)}${isFullPayment ? ' (Lunas)' : ''}`,
    `Sisa Pelunasan (saat pengambilan): ${formatIDR(payment.remainingAmount)}`,
    `Status Pesanan: ${booking.status}`,
    '',
    `Mohon verifikasi bukti transfer ${isFullPayment ? 'pembayaran' : 'DP'} dan konfirmasi reservasi ini. Terima kasih.`,
  ].join('\n');
}

export function buildBookingWhatsAppUrl(
  booking: BookingWithDetails,
  targetNumber?: string | null,
  defaultDpPercent = 50
): string {
  const cleanTarget = formatWhatsAppInternational(
    targetNumber,
    ADMIN_WHATSAPP_NUMBER
  );
  const message = buildBookingWhatsAppMessage(booking, defaultDpPercent);
  return `https://wa.me/${cleanTarget}?text=${encodeURIComponent(message)}`;
}
