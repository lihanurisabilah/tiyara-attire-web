import { BookingWithDetails } from '../types/database';
import {
  formatDateID,
  formatIDR,
  resolveBookingItems,
  resolveBookingPayment,
} from './format';

/**
 * Nomor WhatsApp tujuan admin untuk menerima notifikasi pesanan baru.
 * Gunakan format kode negara tanpa tanda "+" atau spasi (contoh: '6281234567890').
 */
export const ADMIN_WHATSAPP_NUMBER = '6281234567890';

export function buildBookingWhatsAppMessage(
  booking: BookingWithDetails,
  defaultDpPercent = 50
): string {
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
    ? `Pickup Store - ${booking.pickup_location.name} (${booking.pickup_location.address})`
    : 'Pickup Store - Butik Tiyara Attire';

  const payment = resolveBookingPayment(booking, defaultDpPercent);
  const isFullPayment = payment.paymentScheme === 'FULL' || payment.remainingAmount === 0;

  return [
    '*NOTIFIKASI PESANAN BARU - TIYARA ATTIRE*',
    '',
    `Kode Booking: ${booking.booking_code}`,
    `Nama Pelanggan: ${booking.customer_name}`,
    `Nomor Telepon: ${booking.customer_phone}`,
    `Alamat Penyewa: ${customerAddress}`,
    'Daftar Kebaya Disewa:',
    kebayaLines,
    `Tanggal Sewa: ${formatDateID(booking.start_date)} s/d ${formatDateID(booking.end_date)} (${booking.duration_days} Hari)`,
    `Lokasi Pengambilan: ${pickupDetails}`,
    `Skema Pembayaran: ${isFullPayment ? 'Bayar Langsung (Lunas 100%)' : `Bayar DP (${defaultDpPercent}%)`}`,
    `Total Harga Sewa Keseluruhan: ${formatIDR(payment.grandTotal)} (Subtotal ${formatIDR(booking.subtotal)} + Deposit ${formatIDR(booking.deposit_security)})`,
    isFullPayment
      ? `Nominal Dibayar Sekarang: ${formatIDR(payment.dpAmount)} (Lunas)`
      : `Nominal DP Dibayar Sekarang: ${formatIDR(payment.dpAmount)}`,
    `Sisa Pelunasan (saat pengambilan di cabang): ${formatIDR(payment.remainingAmount)}`,
    `Status Pesanan: ${booking.status}`,
    '',
    `Mohon verifikasi bukti transfer ${isFullPayment ? 'pembayaran' : 'DP'} dan konfirmasi reservasi ini. Terima kasih.`,
  ].join('\n');
}

export function buildBookingWhatsAppUrl(
  booking: BookingWithDetails,
  targetNumber: string = ADMIN_WHATSAPP_NUMBER,
  defaultDpPercent = 50
): string {
  const cleanTarget = targetNumber.replace(/[^\d]/g, '') || ADMIN_WHATSAPP_NUMBER;
  const message = buildBookingWhatsAppMessage(booking, defaultDpPercent);
  return `https://wa.me/${cleanTarget}?text=${encodeURIComponent(message)}`;
}
