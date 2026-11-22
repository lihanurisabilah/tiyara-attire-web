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
import { BrandLogo } from './components/BrandLogo';
import { CustomerMode } from './components/CustomerMode';
import {
  PREVIEW_BOOKINGS,
  PREVIEW_KEBAYAS,
  PREVIEW_PICKUP_LOCATIONS,
} from './data/previewFallback';
import { normalizePhoneID } from './lib/format';
import { loadSiteSettings, saveSiteSettings } from './lib/settings';
import { SUPABASE_PERMISSION_SQL, supabase } from './lib/supabase';
import {
  Booking,
  BookingItemDetail,
  BookingStatus,
  BookingWithDetails,
  Kebaya,
  PickupLocation,
} from './types/database';
import { SiteContentSettings } from './types/settings';

const BOOKING_EXTRAS_KEY = 'tiyara_booking_extras_v1';

interface BookingExtraRecord {
  customer_address?: string | null;
  items_detail?: BookingItemDetail[] | null;
  dp_amount?: number | null;
  remaining_amount?: number | null;
  payment_scheme?: string | null;
}

function loadBookingExtras(): Record<string, BookingExtraRecord> {
  try {
    const raw = localStorage.getItem(BOOKING_EXTRAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveBookingExtra(bookingCode: string, extra: BookingExtraRecord) {
  if (!bookingCode) return;
  try {
    const all = loadBookingExtras();
    all[bookingCode.trim().toUpperCase()] = {
      ...(all[bookingCode.trim().toUpperCase()] || {}),
      ...extra,
    };
    localStorage.setItem(BOOKING_EXTRAS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

function mergeBookingWithExtra(
  row: Booking,
  extrasMap: Record<string, BookingExtraRecord>
): Booking {
  const extra = extrasMap[String(row.booking_code || '').trim().toUpperCase()];
  if (!extra) return row;
  return {
    ...row,
    customer_address:
      row.customer_address || extra.customer_address || row.delivery_address,
    items_detail:
      Array.isArray(row.items_detail) && row.items_detail.length > 0
        ? row.items_detail
        : extra.items_detail || null,
    dp_amount:
      row.dp_amount !== undefined && row.dp_amount !== null
        ? row.dp_amount
        : (extra.dp_amount ?? null),
    remaining_amount:
      row.remaining_amount !== undefined && row.remaining_amount !== null
        ? row.remaining_amount
        : (extra.remaining_amount ?? null),
    payment_scheme: row.payment_scheme || extra.payment_scheme || null,
  };
}

const KEBAYA_EXTRAS_KEY = 'tiyara_kebaya_extras_v1';

interface KebayaExtraRecord {
  available_sizes?: string[] | string | null;
  rental_benefits?: string | null;
  rental_terms?: string | null;
}

function loadKebayaExtras(): Record<string, KebayaExtraRecord> {
  try {
    const raw = localStorage.getItem(KEBAYA_EXTRAS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveKebayaExtra(kebayaId: string | number, extra: KebayaExtraRecord) {
  if (kebayaId === undefined || kebayaId === null || kebayaId === '') return;
  try {
    const all = loadKebayaExtras();
    const key = String(kebayaId);
    all[key] = {
      ...(all[key] || {}),
      ...extra,
    };
    localStorage.setItem(KEBAYA_EXTRAS_KEY, JSON.stringify(all));
  } catch {
    // ignore storage errors
  }
}

function mergeKebayaWithExtra(
  row: Kebaya,
  extrasMap: Record<string, KebayaExtraRecord>
): Kebaya {
  const extra = extrasMap[String(row.id)];
  if (!extra) return row;
  return {
    ...row,
    available_sizes:
      row.available_sizes !== undefined && row.available_sizes !== null
        ? row.available_sizes
        : extra.available_sizes ?? null,
    rental_benefits: row.rental_benefits ?? extra.rental_benefits ?? null,
    rental_terms: row.rental_terms ?? extra.rental_terms ?? null,
  };
}

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
  const [siteSettings, setSiteSettings] = useState<SiteContentSettings>(() =>
    loadSiteSettings()
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tiyara_site_settings_v1') {
        setSiteSettings(loadSiteSettings());
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleSaveSettings = (next: SiteContentSettings) => {
    saveSiteSettings(next);
    setSiteSettings(next);
  };

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

  const enrichedKebayas = useMemo<Kebaya[]>(() => {
    const extrasMap = loadKebayaExtras();
    return kebayas.map((k) => mergeKebayaWithExtra(k, extrasMap));
  }, [kebayas]);

  const bookingsWithDetails = useMemo<BookingWithDetails[]>(() => {
    const kebayaMap = new Map<string, Kebaya>();
    enrichedKebayas.forEach((k) => kebayaMap.set(String(k.id), k));

    const pickupMap = new Map<string, PickupLocation>();
    pickupLocations.forEach((p) => pickupMap.set(String(p.id), p));

    const extrasMap = loadBookingExtras();

    return bookings.map((raw) => {
      const b = mergeBookingWithExtra(raw, extrasMap);
      return {
        ...b,
        kebaya: kebayaMap.get(String(b.kebaya_id)) || null,
        pickup_location: b.pickup_location_id
          ? pickupMap.get(String(b.pickup_location_id)) || null
          : null,
      };
    });
  }, [bookings, enrichedKebayas, pickupLocations]);

  const handleCreateBooking = async (
    payload: Omit<Booking, 'id'>
  ): Promise<{ success: boolean; error?: string; booking?: Booking }> => {
    saveBookingExtra(payload.booking_code, {
      customer_address: payload.customer_address || payload.delivery_address,
      items_detail: payload.items_detail || null,
      dp_amount: payload.dp_amount ?? null,
      remaining_amount: payload.remaining_amount ?? null,
      payment_scheme: payload.payment_scheme || 'DP',
    });

    try {
      const insertAttempt = await supabase
        .from('bookings')
        .insert([payload])
        .select()
        .single();

      if (insertAttempt.error) {
        const errCode = insertAttempt.error.code;
        const errMsg = insertAttempt.error.message || '';

        // If remote table does not yet have optional columns (customer_address, items_detail, dp_amount, remaining_amount, payment_scheme), retry with base schema
        if (
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          /customer_address|items_detail|dp_amount|remaining_amount|payment_scheme/i.test(
            errMsg
          )
        ) {
          const {
            customer_address,
            items_detail,
            dp_amount,
            remaining_amount,
            payment_scheme,
            ...legacyPayload
          } = payload;
          const fallbackPayload = {
            ...legacyPayload,
            delivery_address:
              customer_address || legacyPayload.delivery_address || null,
          };
          const retryAttempt = await supabase
            .from('bookings')
            .insert([fallbackPayload])
            .select()
            .single();

          if (!retryAttempt.error && retryAttempt.data) {
            const inserted: Booking = {
              ...(retryAttempt.data as Booking),
              customer_address:
                customer_address || fallbackPayload.delivery_address,
              items_detail: items_detail || null,
              dp_amount: dp_amount ?? null,
              remaining_amount: remaining_amount ?? null,
              payment_scheme: payment_scheme || 'DP',
            };
            setBookings((prev) => [inserted, ...prev]);
            return { success: true, booking: inserted };
          }
          if (retryAttempt.error?.code === '42501' || isFallbackActive) {
            const localBooking: Booking = { ...payload, id: Date.now() };
            setBookings((prev) => [localBooking, ...prev]);
            return { success: true, booking: localBooking };
          }
          return {
            success: false,
            error: retryAttempt.error?.message || 'Gagal menyimpan transaksi.',
          };
        }

        if (errCode === '42501' || isFallbackActive) {
          const localBooking: Booking = {
            ...payload,
            id: Date.now(),
          };
          setBookings((prev) => [localBooking, ...prev]);
          return { success: true, booking: localBooking };
        }
        return { success: false, error: errMsg };
      }

      const inserted = insertAttempt.data as Booking;
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

  const handleUpdateBooking = async (
    bookingId: string | number,
    patch: Partial<Omit<Booking, 'id'>>
  ): Promise<{ success: boolean; error?: string }> => {
    const targetBooking = bookings.find(
      (b) => String(b.id) === String(bookingId)
    );
    if (targetBooking?.booking_code) {
      saveBookingExtra(targetBooking.booking_code, {
        ...(patch.customer_address !== undefined
          ? { customer_address: patch.customer_address }
          : {}),
        ...(patch.items_detail !== undefined
          ? { items_detail: patch.items_detail }
          : {}),
        ...(patch.dp_amount !== undefined ? { dp_amount: patch.dp_amount } : {}),
        ...(patch.remaining_amount !== undefined
          ? { remaining_amount: patch.remaining_amount }
          : {}),
        ...(patch.payment_scheme !== undefined
          ? { payment_scheme: patch.payment_scheme }
          : {}),
      });
    }

    try {
      const attempt = await supabase
        .from('bookings')
        .update(patch)
        .eq('id', bookingId)
        .select()
        .single();

      if (attempt.error) {
        const errCode = attempt.error.code;
        const errMsg = attempt.error.message || '';

        if (
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          /customer_address|items_detail|dp_amount|remaining_amount|payment_scheme/i.test(
            errMsg
          )
        ) {
          const {
            customer_address,
            items_detail,
            dp_amount,
            remaining_amount,
            payment_scheme,
            ...legacyPatch
          } = patch;
          const fallbackPatch = {
            ...legacyPatch,
            ...(customer_address !== undefined
              ? { delivery_address: customer_address }
              : {}),
          };
          const retry = await supabase
            .from('bookings')
            .update(fallbackPatch)
            .eq('id', bookingId)
            .select()
            .single();

          if (!retry.error && retry.data) {
            const updated: Booking = {
              ...(retry.data as Booking),
              customer_address:
                customer_address ?? (retry.data as Booking).delivery_address,
              ...(items_detail !== undefined ? { items_detail } : {}),
              ...(dp_amount !== undefined ? { dp_amount } : {}),
              ...(remaining_amount !== undefined ? { remaining_amount } : {}),
              ...(payment_scheme !== undefined ? { payment_scheme } : {}),
            };
            setBookings((prev) =>
              prev.map((b) =>
                String(b.id) === String(bookingId) ? updated : b
              )
            );
            return { success: true };
          }
          if (retry.error?.code === '42501' || isFallbackActive) {
            setBookings((prev) =>
              prev.map((b) =>
                String(b.id) === String(bookingId) ? { ...b, ...patch } : b
              )
            );
            return { success: true };
          }
          return {
            success: false,
            error: retry.error?.message || 'Gagal memperbarui pesanan.',
          };
        }

        if (errCode === '42501' || isFallbackActive) {
          setBookings((prev) =>
            prev.map((b) =>
              String(b.id) === String(bookingId) ? { ...b, ...patch } : b
            )
          );
          return { success: true };
        }
        return { success: false, error: errMsg };
      }

      const updated = attempt.data as Booking;
      setBookings((prev) =>
        prev.map((b) => (String(b.id) === String(bookingId) ? updated : b))
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal memperbarui pesanan.',
      };
    }
  };

  const handleDeleteBooking = async (
    bookingId: string | number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', bookingId);

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          setBookings((prev) =>
            prev.filter((b) => String(b.id) !== String(bookingId))
          );
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      setBookings((prev) =>
        prev.filter((b) => String(b.id) !== String(bookingId))
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal menghapus pesanan.',
      };
    }
  };

  const handleAddKebaya = async (
    payload: Omit<Kebaya, 'id'>
  ): Promise<{ success: boolean; error?: string; kebaya?: Kebaya }> => {
    try {
      const attempt = await supabase
        .from('kebayas')
        .insert([payload])
        .select()
        .single();

      if (attempt.error) {
        const errCode = attempt.error.code;
        const errMsg = attempt.error.message || '';

        if (
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          /rental_benefits|rental_terms|available_sizes/i.test(errMsg)
        ) {
          const {
            rental_benefits,
            rental_terms,
            available_sizes,
            ...basePayload
          } = payload;
          const retry = await supabase
            .from('kebayas')
            .insert([basePayload])
            .select()
            .single();

          if (!retry.error && retry.data) {
            const inserted = {
              ...(retry.data as Kebaya),
              available_sizes,
              rental_benefits,
              rental_terms,
            };
            saveKebayaExtra(inserted.id, {
              available_sizes,
              rental_benefits,
              rental_terms,
            });
            setKebayas((prev) => [inserted, ...prev]);
            return { success: true, kebaya: inserted };
          }
          if (retry.error?.code === '42501' || isFallbackActive) {
            const localKebaya: Kebaya = { ...payload, id: Date.now() };
            saveKebayaExtra(localKebaya.id, {
              available_sizes: payload.available_sizes,
              rental_benefits: payload.rental_benefits,
              rental_terms: payload.rental_terms,
            });
            setKebayas((prev) => [localKebaya, ...prev]);
            return { success: true, kebaya: localKebaya };
          }
          return {
            success: false,
            error: retry.error?.message || 'Gagal menambahkan kebaya.',
          };
        }

        if (errCode === '42501' || isFallbackActive) {
          const localKebaya: Kebaya = {
            ...payload,
            id: Date.now(),
          };
          saveKebayaExtra(localKebaya.id, {
            available_sizes: payload.available_sizes,
            rental_benefits: payload.rental_benefits,
            rental_terms: payload.rental_terms,
          });
          setKebayas((prev) => [localKebaya, ...prev]);
          return { success: true, kebaya: localKebaya };
        }
        return { success: false, error: errMsg };
      }

      const inserted = attempt.data as Kebaya;
      saveKebayaExtra(inserted.id, {
        available_sizes: inserted.available_sizes ?? payload.available_sizes,
        rental_benefits: inserted.rental_benefits ?? payload.rental_benefits,
        rental_terms: inserted.rental_terms ?? payload.rental_terms,
      });
      setKebayas((prev) => [inserted, ...prev]);
      return { success: true, kebaya: inserted };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal menambahkan kebaya.',
      };
    }
  };

  const handleUpdateKebaya = async (
    id: string | number,
    payload: Partial<Omit<Kebaya, 'id'>>
  ): Promise<{ success: boolean; error?: string }> => {
    saveKebayaExtra(id, {
      ...(payload.available_sizes !== undefined
        ? { available_sizes: payload.available_sizes }
        : {}),
      ...(payload.rental_benefits !== undefined
        ? { rental_benefits: payload.rental_benefits }
        : {}),
      ...(payload.rental_terms !== undefined
        ? { rental_terms: payload.rental_terms }
        : {}),
    });

    try {
      const attempt = await supabase
        .from('kebayas')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (attempt.error) {
        const errCode = attempt.error.code;
        const errMsg = attempt.error.message || '';

        if (
          errCode === 'PGRST204' ||
          errCode === '42703' ||
          /rental_benefits|rental_terms|available_sizes/i.test(errMsg)
        ) {
          const {
            rental_benefits,
            rental_terms,
            available_sizes,
            ...basePayload
          } = payload;
          const retry = await supabase
            .from('kebayas')
            .update(basePayload)
            .eq('id', id)
            .select()
            .single();

          if (!retry.error && retry.data) {
            const updated = {
              ...(retry.data as Kebaya),
              ...(available_sizes !== undefined ? { available_sizes } : {}),
              ...(rental_benefits !== undefined ? { rental_benefits } : {}),
              ...(rental_terms !== undefined ? { rental_terms } : {}),
            };
            setKebayas((prev) =>
              prev.map((k) => (String(k.id) === String(id) ? updated : k))
            );
            return { success: true };
          }
          if (retry.error?.code === '42501' || isFallbackActive) {
            setKebayas((prev) =>
              prev.map((k) =>
                String(k.id) === String(id) ? { ...k, ...payload } : k
              )
            );
            return { success: true };
          }
          return {
            success: false,
            error: retry.error?.message || 'Gagal memperbarui data kebaya.',
          };
        }

        if (errCode === '42501' || isFallbackActive) {
          setKebayas((prev) =>
            prev.map((k) =>
              String(k.id) === String(id) ? { ...k, ...payload } : k
            )
          );
          return { success: true };
        }
        return { success: false, error: errMsg };
      }

      const updated = attempt.data as Kebaya;
      setKebayas((prev) =>
        prev.map((k) => (String(k.id) === String(id) ? updated : k))
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal memperbarui data kebaya.',
      };
    }
  };

  const handleDeleteKebaya = async (
    id: string | number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.from('kebayas').delete().eq('id', id);

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          setKebayas((prev) => prev.filter((k) => String(k.id) !== String(id)));
          return { success: true };
        }
        if (error.code === '23503') {
          return {
            success: false,
            error:
              'Kebaya ini tidak dapat dihapus karena sudah terhubung dengan riwayat pesanan pelanggan. Anda dapat mengurangi stok menjadi 0.',
          };
        }
        return { success: false, error: error.message };
      }

      setKebayas((prev) => prev.filter((k) => String(k.id) !== String(id)));
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error ? err.message : 'Gagal menghapus kebaya.',
      };
    }
  };

  const handleAddPickupLocation = async (payload: {
    name: string;
    address: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('pickup_locations')
        .insert([payload])
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          const localLoc: PickupLocation = {
            id: Date.now(),
            name: payload.name,
            address: payload.address,
          };
          setPickupLocations((prev) => [...prev, localLoc]);
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      setPickupLocations((prev) => [...prev, data as PickupLocation]);
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal menambahkan cabang pengambilan.',
      };
    }
  };

  const handleUpdatePickupLocation = async (
    id: string | number,
    payload: { name: string; address: string }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase
        .from('pickup_locations')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          setPickupLocations((prev) =>
            prev.map((loc) =>
              String(loc.id) === String(id) ? { ...loc, ...payload } : loc
            )
          );
          return { success: true };
        }
        return { success: false, error: error.message };
      }

      const updated = data as PickupLocation;
      setPickupLocations((prev) =>
        prev.map((loc) => (String(loc.id) === String(id) ? updated : loc))
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal memperbarui cabang pengambilan.',
      };
    }
  };

  const handleDeletePickupLocation = async (
    id: string | number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase
        .from('pickup_locations')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === '42501' || isFallbackActive) {
          setPickupLocations((prev) =>
            prev.filter((loc) => String(loc.id) !== String(id))
          );
          return { success: true };
        }
        if (error.code === '23503') {
          return {
            success: false,
            error:
              'Cabang ini terhubung dengan pesanan yang sudah ada. Nonaktifkan cabang ini agar tidak muncul di Form Reservasi Customer.',
          };
        }
        return { success: false, error: error.message };
      }

      setPickupLocations((prev) =>
        prev.filter((loc) => String(loc.id) !== String(id))
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : 'Gagal menghapus cabang pengambilan.',
      };
    }
  };

  const handleTogglePickupActive = (id: string | number) => {
    const idStr = String(id);
    const currentDisabled = siteSettings.bookingForm.disabledPickupIds || [];
    const nextDisabled = currentDisabled.includes(idStr)
      ? currentDisabled.filter((item) => item !== idStr)
      : [...currentDisabled, idStr];
    handleSaveSettings({
      ...siteSettings,
      bookingForm: {
        ...siteSettings.bookingForm,
        disabledPickupIds: nextDisabled,
      },
    });
  };

  const activePickupLocations = useMemo(() => {
    const disabledSet = new Set(
      siteSettings.bookingForm.disabledPickupIds || []
    );
    return pickupLocations.filter(
      (loc) => !disabledSet.has(String(loc.id)) && loc.is_active !== false
    );
  }, [pickupLocations, siteSettings.bookingForm.disabledPickupIds]);

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

    const extrasMap = loadBookingExtras();

    const enrichBooking = (raw: Booking): BookingWithDetails => {
      const row = mergeBookingWithExtra(raw, extrasMap);
      const matchedKebaya = enrichedKebayas.find(
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
            className="flex items-center gap-2 whitespace-nowrap shrink-0 min-w-0"
            aria-label="Tiyara Attire Beranda"
          >
            <BrandLogo
              logoUrl={siteSettings.brand?.logoUrl}
              brandName="Tiyara Attire"
              size="md"
            />
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
          kebayas={enrichedKebayas}
          pickupLocations={activePickupLocations}
          loading={loading}
          siteSettings={siteSettings}
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
          kebayas={enrichedKebayas}
          bookings={bookingsWithDetails}
          pickupLocations={pickupLocations}
          loading={loading}
          siteSettings={siteSettings}
          onSaveSettings={handleSaveSettings}
          onRefresh={fetchAllData}
          onLogout={handleAdminLogout}
          onUpdateBookingStatus={handleUpdateBookingStatus}
          onUpdateBooking={handleUpdateBooking}
          onDeleteBooking={handleDeleteBooking}
          onAddKebaya={handleAddKebaya}
          onUpdateKebaya={handleUpdateKebaya}
          onDeleteKebaya={handleDeleteKebaya}
          onAddPickupLocation={handleAddPickupLocation}
          onUpdatePickupLocation={handleUpdatePickupLocation}
          onDeletePickupLocation={handleDeletePickupLocation}
          onTogglePickupActive={handleTogglePickupActive}
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
