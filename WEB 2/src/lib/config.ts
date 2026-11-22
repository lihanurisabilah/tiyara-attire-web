import { BookingWithDetails } from '../types/database';
import { formatDateID, formatIDR } from './format';

/**
 * Nomor WhatsApp tujuan admin untuk menerima notifikasi pesanan baru.
 * Gunakan format kode negara tanpa tanda "+" atau spasi (contoh: '6281234567890').
 */
export const ADMIN_WHATSAPP_NUMBER = '6281234567890';

export function buildBookingWhatsAppMessage(booking: BookingWithDetails): string {
  const kebayaLabel = booking.kebaya
    ? `${booking.kebaya.name} (Ukuran ${booking.kebaya.size})`
    : `Kebaya #${booking.kebaya_id}`;

  const customerAddress =
    booking.customer_address || booking.delivery_address || '-';

  const pickupDetails = booking.pickup_location
    ? `Pickup Store - ${booking.pickup_location.name} (${booking.pickup_location.address})`
    : 'Pickup Store - Butik Tiyara Attire';

  return [
    '*NOTIFIKASI PESANAN BARU - TIYARA ATTIRE*',
    '',
    `Kode Booking: ${booking.booking_code}`,
    `Nama Pelanggan: ${booking.customer_name}`,
    `Nomor Telepon: ${booking.customer_phone}`,
    `Alamat Penyewa: ${customerAddress}`,
    `Kebaya: ${kebayaLabel}`,
    `Tanggal Sewa: ${formatDateID(booking.start_date)} s/d ${formatDateID(booking.end_date)} (${booking.duration_days} Hari)`,
    `Lokasi Pengambilan: ${pickupDetails}`,
    `Total Biaya: ${formatIDR(booking.grand_total)} (Subtotal ${formatIDR(booking.subtotal)} + Deposit ${formatIDR(booking.deposit_security)})`,
    `Status Pesanan: ${booking.status}`,
    '',
    'Mohon verifikasi bukti transfer dan konfirmasi reservasi ini. Terima kasih.',
  ].join('\n');
}

export function buildBookingWhatsAppUrl(
  booking: BookingWithDetails,
  targetNumber: string = ADMIN_WHATSAPP_NUMBER
): string {
  const cleanTarget = targetNumber.replace(/[^\d]/g, '') || ADMIN_WHATSAPP_NUMBER;
  const message = buildBookingWhatsAppMessage(booking);
  return `https://wa.me/${cleanTarget}?text=${encodeURIComponent(message)}`;
}
