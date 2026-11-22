import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Check,
  Copy,
  RefreshCw,
  ShoppingBag,
  X,
} from 'lucide-react';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLogin } from './components/AdminLogin';
import { CustomerMode } from './components/CustomerMode';
import {
  PREVIEW_BOOKINGS,
  PREVIEW_KEBAYAS,
  PREVIEW_PICKUP_LOCATIONS,
} from './data/previewFallback';
import { normalizePhoneID } from './lib/format';
import { SUPABASE_PERMISSION_SQL, supabase } from './lib/supabase';
import {
  Booking,
  BookingStatus,
  BookingWithDetails,
  Kebaya,
  PickupLocation,
} from './types/database';

type AppMode = 'customer' | 'admin';

export default function App() {
  const [mode, setMode] = useState<AppMode>('customer');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(
    () => {
      try {
        return sessionStorage.getItem('tiyara_admin_auth') === 'true';
      } catch {
        return false;
      }
    }
  );
  const [kebayas, setKebayas] = useState<Kebaya[]>([]);
  const [pickupLocations, setPickupLocations] = useState<PickupLocation[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [permissionAlert, setPermissionAlert] = useState<string | null>(null);
  const [showSqlModal, setShowSqlModal] = useState<boolean>(false);
  const [copiedSql, setCopiedSql] = useState<boolean>(false);
  const [isFallbackActive, setIsFallbackActive] = useState<boolean>(false);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [kebayasRes, pickupRes, bookingsRes] = await Promise.all([
        supabase.from('kebayas').select('*').order('id', { ascending: false }),
        supabase
          .from('pickup_locations')
          .select('*')
          .order('id', { ascending: true }),
        supabase.from('bookings').select('*').order('id', { ascending: false }),
      ]);

      const firstError =
        kebayasRes.error || pickupRes.error || bookingsRes.error;

      if (firstError) {
        if (firstError.code === '42501') {
          setPermissionAlert(
            `Supabase mengembalikan izin ditolak (42501: ${firstError.message}). Menampilkan data pratinjau agar alur aplikasi tetap dapat diuji.`
          );
          setIsFallbackActive(true);
          setKebayas((prev) => (prev.length > 0 ? prev : PREVIEW_KEBAYAS));
          setPickupLocations((prev) =>
            prev.length > 0 ? prev : PREVIEW_PICKUP_LOCATIONS
          );
          setBookings((prev) => (prev.length > 0 ? prev : PREVIEW_BOOKINGS));
        } else {
          setPermissionAlert(
            `Gagal memuat data Supabase: ${firstError.message}`
          );
        }
      } else {
        setPermissionAlert(null);
        setIsFallbackActive(false);
        setKebayas((kebayasRes.data as Kebaya[]) || []);
        setPickupLocations((pickupRes.data as PickupLocation[]) || []);
        setBookings((bookingsRes.data as Booking[]) || []);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Koneksi Supabase gagal.';
      setPermissionAlert(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllData();

    const channel = supabase
      .channel('tiyara-realtime-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'kebayas' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pickup_locations' },
        () => {
          fetchAllData();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchAllData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAllData]);

  const bookingsWithDetails = useMemo<BookingWithDetails[]>(() => {
    const kebayaMap = new Map<string, Kebaya>();
    kebayas.forEach((k) => kebayaMap.set(String(k.id), k));

    const pickupMap = new Map<string, PickupLocation>();
    pickupLocations.forEach((p) => pickupMap.set(String(p.id), p));

    return bookings.map((b) => ({
      ...b,
      kebaya: kebayaMap.get(String(b.kebaya_id)) || null,
      pickup_location: b.pickup_location_id
        ? pickupMap.get(String(b.pickup_location_id)) || null
        : null,
    }));
  }, [bookings, kebayas, pickupLocations]);

  const handleCreateBooking = async (
    payload: Omit<Booking, 'id'>
  ): Promise<{ success: boolean; error?: string; booking?: Booking }> => {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          const localBooking: Booking = {
            ...payload,
            id: Date.now(),
          };
          setBookings((prev) => [localBooking, ...prev]);
          return { success: true, booking: localBooking };
        }
        return { success: false, error: error.message };
      }

      const inserted = data as Booking;
      setBookings((prev) => [inserted, ...prev]);
      return { success: true, booking: inserted };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal menyimpan transaksi.',
      };
    }
  };

  const handleUpdateBookingStatus = async (
    bookingId: string | number,
    status: BookingStatus
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status })
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          setBookings((prev) =>
            prev.map((b) =>
              String(b.id) === String(bookingId) ? { ...b, status } : b
            )
          );
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      setBookings((prev) =>
        prev.map((b) =>
          String(b.id) === String(bookingId) ? { ...b, status } : b
        )
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal memperbarui status pesanan.',
      };
    }
  };

  const handleAddKebaya = async (
    payload: Omit<Kebaya, 'id'>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('kebayas')
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          const localKebaya: Kebaya = {
            ...payload,
            id: Date.now(),
          };
          setKebayas((prev) => [localKebaya, ...prev]);
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      setKebayas((prev) => [data as Kebaya, ...prev]);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal menambahkan kebaya.',
      };
    }
  };

  const handleAdminLogout = () => {
    try {
      sessionStorage.removeItem('tiyara_admin_auth');
    } catch {
      // ignore storage errors
    }
    setIsAdminAuthenticated(false);
    setMode('customer');
  };

  const handleTrackBooking = async (
    bookingCode: string,
    phone: string
  ): Promise<{
    found: boolean;
    booking?: BookingWithDetails;
    error?: string;
  }> => {
    const cleanCode = bookingCode.trim().toUpperCase();
    const cleanPhone = normalizePhoneID(phone);

    if (!cleanCode || !cleanPhone) {
      return {
        found: false,
        error:
          'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.',
      };
    }

    const enrichBooking = (row: Booking): BookingWithDetails => {
      const matchedKebaya = kebayas.find(
        (k) => String(k.id) === String(row.kebaya_id)
      );
      const matchedPickup = row.pickup_location_id
        ? pickupLocations.find(
            (p) => String(p.id) === String(row.pickup_location_id)
          )
        : null;
      return {
        ...row,
        kebaya: matchedKebaya || null,
        pickup_location: matchedPickup || null,
      };
    };

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .ilike('booking_code', cleanCode);

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          const localMatch = bookings.find(
            (b) =>
              b.booking_code.trim().toUpperCase() === cleanCode &&
              normalizePhoneID(b.customer_phone) === cleanPhone
          );
          if (localMatch) {
            return { found: true, booking: enrichBooking(localMatch) };
          }
          return {
            found: false,
            error:
              'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.',
          };
        }
        return {
          found: false,
          error:
            'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.',
        };
      }

      const rows = (data as Booking[]) || [];
      const matched = rows.find(
        (row) => normalizePhoneID(row.customer_phone) === cleanPhone
      );

      if (!matched) {
        return {
          found: false,
          error:
            'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.',
        };
      }

      return { found: true, booking: enrichBooking(matched) };
    } catch {
      return {
        found: false,
        error:
          'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.',
      };
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_PERMISSION_SQL);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      setCopiedSql(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5F6] text-[#2A0912]">
      {/* Top Global Navigation Bar with Mode Switcher */}
      <header className="sticky top-0 z-40 h-14 bg-white/95 backdrop-blur-md border-b border-[#6B1D2F]/12">
        <div className="max-w-[1440px] mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setMode('customer');
            }}
            className="flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              className="shrink-0"
            >
              <circle cx="12" cy="12" r="11" fill="#6B1D2F" />
              <path
                d="M7.5 14.5L9.5 8.5L12 11.5L14.5 8.5L16.5 14.5H7.5Z"
                fill="#D4AF37"
              />
              <rect x="7.5" y="15.5" width="9" height="1.5" rx="0.75" fill="#F9E4E8" />
            </svg>
            <span className="font-display text-xl font-bold text-[#6B1D2F] tracking-tight whitespace-nowrap shrink-0">
              Tiyara Attire
            </span>
          </a>

          {/* Mode Switcher */}
          <div
            role="group"
            aria-label="Pilih mode tampilan"
            className="flex items-center gap-1 p-1 rounded-xl bg-[#F9E4E8]/80 border border-[#6B1D2F]/12 shrink-0"
          >
            <button
              type="button"
              onClick={() => setMode('customer')}
              className={`h-9 px-3 sm:px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                mode === 'customer'
                  ? 'bg-[#6B1D2F] text-white shadow-xs'
                  : 'text-[#6B1D2F] hover:bg-white/60'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Customer</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('admin')}
              className={`h-9 px-3 sm:px-3.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                mode === 'admin'
                  ? 'bg-[#6B1D2F] text-[#D4AF37] shadow-xs'
                  : 'text-[#6B1D2F] hover:bg-white/60'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Admin EDA</span>
            </button>
          </div>
        </div>
      </header>

      {/* Supabase Permission Diagnostic Banner (only shown when DB returns 42501 / error) */}
      {permissionAlert && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-900">
          <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle
                className="w-4 h-4 text-amber-700 shrink-0"
                aria-hidden="true"
              />
              <span className="truncate">{permissionAlert}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSqlModal(true)}
                className="px-2.5 py-1 rounded-md bg-amber-900 text-white font-semibold hover:bg-amber-800 whitespace-nowrap"
              >
                Lihat SQL Grant Supabase
              </button>
              <button
                type="button"
                onClick={fetchAllData}
                className="px-2.5 py-1 rounded-md border border-amber-400 text-amber-900 font-semibold hover:bg-amber-100 inline-flex items-center gap-1 whitespace-nowrap"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>Coba Lagi</span>
              </button>
              <button
                type="button"
                onClick={() => setPermissionAlert(null)}
                className="p-1 text-amber-700 hover:text-amber-950"
                aria-label="Tutup peringatan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Mode Viewport */}
      {mode === 'customer' ? (
        <CustomerMode
          kebayas={kebayas}
          pickupLocations={pickupLocations}
          loading={loading}
          onCreateBooking={handleCreateBooking}
          onTrackBooking={handleTrackBooking}
        />
      ) : !isAdminAuthenticated ? (
        <AdminLogin
          onSuccess={() => setIsAdminAuthenticated(true)}
          onCancel={() => setMode('customer')}
        />
      ) : (
        <AdminDashboard
          kebayas={kebayas}
          bookings={bookingsWithDetails}
          loading={loading}
          onRefresh={fetchAllData}
          onLogout={handleAdminLogout}
          onUpdateBookingStatus={handleUpdateBookingStatus}
          onAddKebaya={handleAddKebaya}
        />
      )}

      {/* SQL Fix Modal for Supabase 42501 */}
      {showSqlModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setShowSqlModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#6B1D2F]/10 pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-[#6B1D2F]">
                  Konfigurasi Izin Tabel Supabase (Anon Role)
                </h3>
                <p className="text-xs text-[#2A0912]/70 mt-0.5">
                  Jalankan skrip SQL berikut pada Supabase SQL Editor agar role anon dapat membaca dan menulis tabel kebayas, pickup_locations, dan bookings.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSqlModal(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B1D2F] hover:bg-[#F9E4E8]"
                aria-label="Tutup modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <pre className="p-3.5 rounded-xl bg-[#2A0912] text-[#F9E4E8] font-mono text-[11px] overflow-x-auto leading-relaxed">
              {SUPABASE_PERMISSION_SQL}
            </pre>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCopySql}
                className="px-4 py-2 rounded-xl bg-[#6B1D2F] text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#4A1220]"
              >
                {copiedSql ? (
                  <>
                    <Check className="w-4 h-4 text-[#D4AF37]" />
                    <span>SQL Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin SQL</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
