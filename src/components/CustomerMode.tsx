import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  FileText,
  Gem,
  Gift,
  GraduationCap,
  Heart,
  Home,
  Instagram,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Tag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  Booking,
  BookingItemDetail,
  BookingWithDetails,
  CartItem,
  Kebaya,
  PickupLocation,
} from '../types/database';
import { CategoryIconKey, SiteContentSettings } from '../types/settings';
import {
  buildBookingWhatsAppUrl,
  formatWhatsAppInternational,
} from '../lib/config';
import {
  DEPOSIT_SECURITY_FEE,
  PROMO_BANNER_IMAGE,
  addDaysToISO,
  formatDateID,
  formatIDR,
  generateBookingCode,
  getTodayISO,
  parseAvailableSizes,
  resolveBookingItems,
  resolveBookingPayment,
} from '../lib/format';
import { BrandLogo } from './BrandLogo';
import { KebayaImage } from './KebayaImage';
import { StatusBadge } from './StatusBadge';

const CART_STORAGE_KEY = 'tiyara_cart_v1';

function resolveInitialSize(kebaya: Kebaya): string {
  const sizes = parseAvailableSizes(kebaya);
  return sizes.length === 1 ? sizes[0] : '';
}

type CustomerTab = 'browse' | 'orders' | 'promo' | 'contact';
type CustomerScreen = 'tab' | 'detail' | 'booking' | 'checkout' | 'success';

interface CustomerModeProps {
  kebayas: Kebaya[];
  pickupLocations: PickupLocation[];
  loading: boolean;
  siteSettings: SiteContentSettings;
  onCreateBooking: (payload: Omit<Booking, 'id'>) => Promise<{
    success: boolean;
    error?: string;
    booking?: Booking;
  }>;
  onTrackBooking: (
    bookingCode: string,
    phone: string
  ) => Promise<{
    found: boolean;
    booking?: BookingWithDetails;
    error?: string;
  }>;
}

const CATEGORY_ICONS: Record<CategoryIconKey, LucideIcon> = {
  sparkles: Sparkles,
  graduation: GraduationCap,
  heart: Heart,
  crown: Crown,
  gem: Gem,
};

const NAV_ITEMS = [
  { id: 'browse' as const, label: 'Browse', icon: Home },
  { id: 'orders' as const, label: 'Pesanan Saya', icon: ReceiptText },
  { id: 'promo' as const, label: 'Promo', icon: Gift },
  { id: 'contact' as const, label: 'Kontak', icon: Phone },
];

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 640;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(reader.result));
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

export const CustomerMode: React.FC<CustomerModeProps> = ({
  kebayas,
  pickupLocations,
  loading,
  siteSettings,
  onCreateBooking,
  onTrackBooking,
}) => {
  const [activeTab, setActiveTab] = useState<CustomerTab>('browse');
  const [screen, setScreen] = useState<CustomerScreen>('tab');
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Lacak Pesanan state
  const [trackCode, setTrackCode] = useState<string>('');
  const [trackPhone, setTrackPhone] = useState<string>('');
  const [trackingLoading, setTrackingLoading] = useState<boolean>(false);
  const [trackedOrder, setTrackedOrder] = useState<BookingWithDetails | null>(
    null
  );
  const [trackNotFoundMsg, setTrackNotFoundMsg] = useState<string | null>(null);

  const [selectedKebaya, setSelectedKebaya] = useState<Kebaya | null>(null);
  const [detailSize, setDetailSize] = useState<string>('');
  const [detailSizeError, setDetailSizeError] = useState<string | null>(null);
  const [detailQty, setDetailQty] = useState<number>(1);

  // Cart State
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem(CART_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [cartToast, setCartToast] = useState<string | null>(null);
  const [quickAddTarget, setQuickAddTarget] = useState<Kebaya | null>(null);
  const [quickAddSize, setQuickAddSize] = useState<string>('');
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddQty, setQuickAddQty] = useState<number>(1);

  const [checkoutSource, setCheckoutSource] = useState<'direct' | 'cart'>(
    'direct'
  );
  const [paymentScheme, setPaymentScheme] = useState<'DP' | 'FULL'>('DP');
  const [directOrderItem, setDirectOrderItem] = useState<CartItem | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
    } catch {
      // ignore storage quota errors
    }
  }, [cartItems]);

  // Booking form state
  const [durationDays, setDurationDays] = useState<number>(3);
  const [startDate, setStartDate] = useState<string>(getTodayISO());
  const [selectedPickupId, setSelectedPickupId] = useState<
    string | number | null
  >(pickupLocations[0]?.id ?? null);

  // Checkout state
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(
    null
  );
  const [paymentProofName, setPaymentProofName] = useState<string>('');
  const [transferConfirmed, setTransferConfirmed] = useState<boolean>(false);
  const [copiedBank, setCopiedBank] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdBooking, setCreatedBooking] =
    useState<BookingWithDetails | null>(null);
  const [createdWaUrl, setCreatedWaUrl] = useState<string | null>(null);
  const [waPopupBlocked, setWaPopupBlocked] = useState<boolean>(false);
  const [bannerImgFailed, setBannerImgFailed] = useState<boolean>(false);

  useEffect(() => {
    setBannerImgFailed(false);
  }, [siteSettings.browse.bannerImageUrl]);

  const effectivePickupId = pickupLocations.some(
    (loc) => String(loc.id) === String(selectedPickupId)
  )
    ? selectedPickupId
    : (pickupLocations[0]?.id ?? null);

  const totalCartCount = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.quantity, 0),
    [cartItems]
  );

  const activeBookingItems = useMemo<CartItem[]>(() => {
    if (checkoutSource === 'cart') {
      return cartItems;
    }
    return directOrderItem ? [directOrderItem] : [];
  }, [checkoutSource, cartItems, directOrderItem]);

  const dpPercentage = useMemo(() => {
    return Math.min(
      90,
      Math.max(10, Number(siteSettings.bookingForm.dpPercentage || 50))
    );
  }, [siteSettings.bookingForm.dpPercentage]);

  const latestKebayas = useMemo(() => {
    return [...kebayas].slice(0, 6);
  }, [kebayas]);

  const filteredKebayas = useMemo(() => {
    return kebayas.filter((item) => {
      const matchesCat =
        selectedCategory === 'Semua' ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      const q = searchQuery.trim().toLowerCase();
      const availableSizesText = parseAvailableSizes(item).join(' ').toLowerCase();
      const matchesQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q) ||
        item.size.toLowerCase().includes(q) ||
        availableSizesText.includes(q);
      return matchesCat && matchesQuery;
    });
  }, [kebayas, selectedCategory, searchQuery]);

  const showCartToast = (message: string) => {
    setCartToast(message);
    window.setTimeout(() => {
      setCartToast((prev) => (prev === message ? null : prev));
    }, 3200);
  };

  const addToCart = (kebaya: Kebaya, size: string, qty: number) => {
    const cleanQty = Math.max(1, qty);
    const maxStock = Math.max(1, Number(kebaya.stock || 1));
    const cartKey = `${kebaya.id}::${size}`;

    setCartItems((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
      if (existing) {
        return prev.map((item) =>
          item.cartKey === cartKey
            ? { ...item, quantity: Math.min(maxStock, item.quantity + cleanQty) }
            : item
        );
      }
      return [
        ...prev,
        {
          cartKey,
          kebaya,
          selectedSize: size,
          quantity: Math.min(maxStock, cleanQty),
        },
      ];
    });
    showCartToast(`${kebaya.name} (Uk. ${size}) ditambahkan ke keranjang.`);
  };

  const updateCartItemQty = (cartKey: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          if (item.cartKey !== cartKey) return item;
          const maxStock = Math.max(1, Number(item.kebaya.stock || 1));
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...item, quantity: Math.min(maxStock, nextQty) };
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const updateCartItemSize = (cartKey: string, nextSize: string) => {
    setCartItems((prev) => {
      const target = prev.find((item) => item.cartKey === cartKey);
      if (!target || target.selectedSize === nextSize) return prev;
      const newKey = `${target.kebaya.id}::${nextSize}`;
      const existingSameSize = prev.find((item) => item.cartKey === newKey);
      if (existingSameSize) {
        const maxStock = Math.max(1, Number(target.kebaya.stock || 1));
        return prev
          .filter((item) => item.cartKey !== cartKey)
          .map((item) =>
            item.cartKey === newKey
              ? {
                  ...item,
                  quantity: Math.min(maxStock, item.quantity + target.quantity),
                }
              : item
          );
      }
      return prev.map((item) =>
        item.cartKey === cartKey
          ? { ...item, cartKey: newKey, selectedSize: nextSize }
          : item
      );
    });
  };

  const removeCartItem = (cartKey: string) => {
    setCartItems((prev) => prev.filter((item) => item.cartKey !== cartKey));
  };

  const openQuickAddModal = (kebaya: Kebaya) => {
    setQuickAddTarget(kebaya);
    setQuickAddSize(resolveInitialSize(kebaya));
    setQuickAddError(null);
    setQuickAddQty(1);
  };

  const handleSearchOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setTrackNotFoundMsg(null);
    setTrackedOrder(null);

    if (!trackCode.trim() || !trackPhone.trim()) {
      setTrackNotFoundMsg(
        'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.'
      );
      return;
    }

    setTrackingLoading(true);
    const res = await onTrackBooking(trackCode, trackPhone);
    setTrackingLoading(false);

    if (res.found && res.booking) {
      setTrackedOrder(res.booking);
    } else {
      setTrackNotFoundMsg(
        res.error ||
          'Pesanan tidak ditemukan. Pastikan Kode Booking dan Nomor Telepon sesuai.'
      );
    }
  };

  const subtotal = useMemo(() => {
    return activeBookingItems.reduce(
      (sum, item) =>
        sum +
        Number(item.kebaya.price_per_3days || 0) *
          item.quantity *
          (durationDays / 3),
      0
    );
  }, [activeBookingItems, durationDays]);

  const grandTotal = subtotal + DEPOSIT_SECURITY_FEE;
  const dpAmount = Math.round((grandTotal * dpPercentage) / 100);
  const payableNow = paymentScheme === 'FULL' ? grandTotal : dpAmount;
  const remainingAmount =
    paymentScheme === 'FULL' ? 0 : Math.max(0, grandTotal - dpAmount);
  const endDate = addDaysToISO(startDate, durationDays);

  const selectedPickupLocation = pickupLocations.find(
    (loc) => String(loc.id) === String(effectivePickupId)
  );

  const openDetail = (kebaya: Kebaya) => {
    setSelectedKebaya(kebaya);
    setDetailSize(resolveInitialSize(kebaya));
    setDetailSizeError(null);
    setDetailQty(1);
    setFormError(null);
    setScreen('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDetailAddToCart = () => {
    if (!selectedKebaya) return;
    const avail = parseAvailableSizes(selectedKebaya);
    const chosen = detailSize || (avail.length === 1 ? avail[0] : '');
    if (!chosen || !avail.includes(chosen)) {
      setDetailSizeError(
        'Silakan pilih salah satu size yang tersedia terlebih dahulu.'
      );
      return;
    }
    setDetailSizeError(null);
    addToCart(selectedKebaya, chosen, detailQty);
  };

  const startDirectBooking = () => {
    if (!selectedKebaya) return;
    const avail = parseAvailableSizes(selectedKebaya);
    const chosen = detailSize || (avail.length === 1 ? avail[0] : '');
    if (!chosen || !avail.includes(chosen)) {
      setDetailSizeError(
        'Silakan pilih salah satu size yang tersedia sebelum menyewa.'
      );
      return;
    }
    setDetailSizeError(null);
    setCheckoutSource('direct');
    setDirectOrderItem({
      cartKey: `${selectedKebaya.id}::${chosen}`,
      kebaya: selectedKebaya,
      selectedSize: chosen,
      quantity: Math.max(1, detailQty),
    });
    setDurationDays(3);
    setStartDate(getTodayISO());
    if (!selectedPickupId && pickupLocations[0]) {
      setSelectedPickupId(pickupLocations[0].id);
    }
    setFormError(null);
    setScreen('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCheckoutFromCart = () => {
    if (cartItems.length === 0) return;
    setCheckoutSource('cart');
    setIsCartOpen(false);
    setDurationDays(3);
    setStartDate(getTodayISO());
    if (!selectedPickupId && pickupLocations[0]) {
      setSelectedPickupId(pickupLocations[0].id);
    }
    setFormError(null);
    setScreen('booking');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (activeBookingItems.length === 0) {
      setFormError('Belum ada kebaya yang dipilih untuk disewa.');
      return;
    }
    if (!startDate) {
      setFormError('Silakan pilih tanggal mulai sewa terlebih dahulu.');
      return;
    }
    if (!effectivePickupId) {
      setFormError('Silakan pilih lokasi cabang pengambilan di butik.');
      return;
    }

    setScreen('checkout');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file);
      setPaymentProofPreview(compressed);
      setPaymentProofName(file.name);
      setFormError(null);
    } catch {
      setFormError('Gagal memproses file bukti transfer.');
    }
  };

  const handleCopyAccount = async (bank: string, accountNumber: string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedBank(bank);
      setTimeout(() => setCopiedBank(null), 2000);
    } catch {
      setCopiedBank(bank);
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activeBookingItems.length === 0) return;
    setFormError(null);

    if (customerName.trim().length < 2) {
      setFormError('Nama lengkap wajib diisi.');
      return;
    }
    if (customerPhone.trim().length < 8) {
      setFormError('Nomor WhatsApp aktif wajib diisi.');
      return;
    }
    if (customerAddress.trim().length < 8) {
      setFormError('Alamat lengkap penyewa wajib diisi.');
      return;
    }
    const isFull = paymentScheme === 'FULL';
    if (!paymentProofPreview) {
      setFormError(
        `Mohon unggah bukti transfer ${isFull ? 'pembayaran' : 'DP'} terlebih dahulu.`
      );
      return;
    }
    if (!transferConfirmed) {
      setFormError(
        `Centang kotak konfirmasi transfer ${isFull ? 'pembayaran' : 'DP'} sebelum melanjutkan.`
      );
      return;
    }

    setSubmitting(true);
    const bookingCode = generateBookingCode();
    const cleanAddress = customerAddress.trim();
    const primaryKebaya = activeBookingItems[0].kebaya;
    const itemsDetail: BookingItemDetail[] = activeBookingItems.map((item) => ({
      kebaya_id: item.kebaya.id,
      kebaya_name: item.kebaya.name,
      category: item.kebaya.category,
      selected_size: item.selectedSize,
      quantity: item.quantity,
      price_per_3days: Number(item.kebaya.price_per_3days || 0),
      image_url: item.kebaya.image_url,
    }));

    const payload: Omit<Booking, 'id'> = {
      booking_code: bookingCode,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      customer_address: cleanAddress,
      kebaya_id: primaryKebaya.id,
      items_detail: itemsDetail,
      duration_days: durationDays,
      start_date: startDate,
      end_date: endDate,
      delivery_method: 'Pickup Store',
      pickup_location_id: effectivePickupId,
      delivery_address: cleanAddress,
      subtotal,
      deposit_security: DEPOSIT_SECURITY_FEE,
      grand_total: grandTotal,
      dp_amount: payableNow,
      remaining_amount: remainingAmount,
      payment_scheme: paymentScheme,
      payment_proof_url: paymentProofPreview,
      status: 'Pending Verification',
    };

    const result = await onCreateBooking(payload);
    setSubmitting(false);

    if (!result.success) {
      setFormError(
        result.error || 'Terjadi kendala saat menyimpan transaksi sewa.'
      );
      return;
    }

    const savedBooking = result.booking || { ...payload };
    const enrichedBooking: BookingWithDetails = {
      ...savedBooking,
      customer_address:
        savedBooking.customer_address ||
        savedBooking.delivery_address ||
        cleanAddress,
      items_detail:
        savedBooking.items_detail && savedBooking.items_detail.length > 0
          ? savedBooking.items_detail
          : itemsDetail,
      dp_amount: savedBooking.dp_amount ?? payableNow,
      remaining_amount: savedBooking.remaining_amount ?? remainingAmount,
      payment_scheme: savedBooking.payment_scheme || paymentScheme,
      kebaya: primaryKebaya,
      pickup_location: selectedPickupLocation || null,
    };
    const waUrl = buildBookingWhatsAppUrl(
      enrichedBooking,
      siteSettings.contact.whatsappNumber,
      dpPercentage
    );

    if (checkoutSource === 'cart') {
      setCartItems([]);
    }

    setCreatedBooking(enrichedBooking);
    setCreatedWaUrl(waUrl);
    setWaPopupBlocked(false);
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setPaymentProofPreview(null);
    setPaymentProofName('');
    setTransferConfirmed(false);
    setScreen('success');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const openedWin = window.open(waUrl, '_blank', 'noopener,noreferrer');
      if (!openedWin) {
        setWaPopupBlocked(true);
      }
    } catch {
      setWaPopupBlocked(true);
    }
  };

  const renderTabContent = () => {
    if (activeTab === 'orders') {
      return (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#6B1D2F]">
              Lacak Pesanan Anda
            </h1>
            <p className="text-xs sm:text-sm text-[#6B1D2F]/75 max-w-2xl">
              Masukkan Kode Booking dan Nomor WhatsApp terdaftar untuk melihat status reservasi Anda secara aman.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <form
              onSubmit={handleSearchOrder}
              className="lg:col-span-5 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4 shadow-xs"
            >
              <div className="space-y-1.5">
                <label
                  htmlFor="track-booking-code"
                  className="block text-xs font-semibold text-[#6B1D2F]"
                >
                  Kode Booking
                </label>
                <input
                  id="track-booking-code"
                  type="text"
                  required
                  value={trackCode}
                  onChange={(e) => {
                    setTrackCode(e.target.value.toUpperCase());
                    if (trackNotFoundMsg) setTrackNotFoundMsg(null);
                  }}
                  placeholder="Contoh: TYR2026XXXX"
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 font-mono text-sm text-[#2A0912] placeholder:font-sans placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="track-customer-phone"
                  className="block text-xs font-semibold text-[#6B1D2F]"
                >
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  id="track-customer-phone"
                  type="tel"
                  required
                  value={trackPhone}
                  onChange={(e) => {
                    setTrackPhone(e.target.value);
                    if (trackNotFoundMsg) setTrackNotFoundMsg(null);
                  }}
                  placeholder="Contoh: 0812xxxxxxxx atau +62812..."
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <button
                type="submit"
                disabled={trackingLoading}
                className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] disabled:opacity-60 transition-colors"
              >
                <Search className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
                <span>
                  {trackingLoading ? 'Mencari Pesanan...' : 'Cari Pesanan'}
                </span>
              </button>
            </form>

            <div className="lg:col-span-7 space-y-4">
              {trackNotFoundMsg && (
                <div
                  role="alert"
                  className="rounded-2xl bg-red-50 border border-red-200 p-5 text-center space-y-1"
                >
                  <p className="text-xs sm:text-sm font-semibold text-red-800">
                    {trackNotFoundMsg}
                  </p>
                </div>
              )}

              {trackedOrder ? (
                (() => {
                  const trackedItems = resolveBookingItems(trackedOrder);
                  const trackedPayment = resolveBookingPayment(
                    trackedOrder,
                    dpPercentage
                  );
                  return (
                    <article className="bg-white rounded-2xl border border-[#6B1D2F]/15 p-5 space-y-4 shadow-xs">
                      <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#6B1D2F]/10">
                        <div>
                          <p className="text-[11px] text-[#6B1D2F]/70">
                            Kode Booking
                          </p>
                          <span className="font-mono text-base font-bold text-[#6B1D2F] tabular-nums">
                            {trackedOrder.booking_code}
                          </span>
                          <p className="text-xs text-[#2A0912]/70 mt-0.5">
                            {trackedOrder.customer_name} ·{' '}
                            {trackedOrder.customer_phone}
                          </p>
                          {(trackedOrder.customer_address ||
                            trackedOrder.delivery_address) && (
                            <p className="text-xs text-[#2A0912]/70 mt-0.5">
                              Alamat:{' '}
                              {trackedOrder.customer_address ||
                                trackedOrder.delivery_address}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={trackedOrder.status} />
                      </div>

                      <div className="space-y-2.5">
                        <p className="text-xs font-semibold text-[#6B1D2F]">
                          Daftar Kebaya Disewa ({trackedItems.length} item)
                        </p>
                        <div className="space-y-2.5">
                          {trackedItems.map((item, idx) => (
                            <div
                              key={`${item.kebaya_id}-${item.selected_size}-${idx}`}
                              className="flex items-center gap-3.5 p-2.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10"
                            >
                              <KebayaImage
                                src={
                                  item.image_url ||
                                  trackedOrder.kebaya?.image_url
                                }
                                alt={item.kebaya_name}
                                category={
                                  item.category ||
                                  trackedOrder.kebaya?.category
                                }
                                className="w-16 h-20 rounded-lg object-cover shrink-0 bg-[#F9E4E8]"
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B1D2F]/75">
                                  <span>{item.category || 'Koleksi Kebaya'}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] font-bold">
                                    Size {item.selected_size}
                                  </span>
                                  <span>· {item.quantity} set</span>
                                </div>
                                <h2 className="text-sm font-bold text-[#2A0912] leading-snug">
                                  {item.kebaya_name}
                                </h2>
                                <p className="text-xs font-semibold text-[#6B1D2F] tabular-nums">
                                  {formatIDR(item.price_per_3days)} / 3 hr
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs sm:text-sm text-[#6B1D2F] font-medium tabular-nums">
                          Periode Sewa: {formatDateID(trackedOrder.start_date)} –{' '}
                          {formatDateID(trackedOrder.end_date)} (
                          {trackedOrder.duration_days} hari)
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10 p-3.5 space-y-1 text-xs">
                        <p className="font-semibold text-[#6B1D2F]">
                          Lokasi Pengambilan: Pickup Store
                        </p>
                        <p className="text-[#2A0912]/75 leading-relaxed">
                          {trackedOrder.pickup_location
                            ? `${trackedOrder.pickup_location.name} — ${trackedOrder.pickup_location.address}`
                            : 'Ambil langsung di Butik Tiyara Attire'}
                        </p>
                      </div>

                      <div className="space-y-2 pt-2 border-t border-[#6B1D2F]/10 text-xs sm:text-sm">
                        <div className="flex items-center justify-between text-[#2A0912]/75">
                          <span>
                            Subtotal Sewa ({trackedOrder.duration_days} hari)
                          </span>
                          <span className="font-semibold tabular-nums">
                            {formatIDR(trackedOrder.subtotal)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[#2A0912]/75">
                          <span>Uang Jaminan / Deposit</span>
                          <span className="font-semibold tabular-nums">
                            {formatIDR(trackedOrder.deposit_security)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-[#6B1D2F]/10">
                          <span className="font-semibold text-[#2A0912]">
                            Total Harga Sewa Keseluruhan
                          </span>
                          <span className="font-bold text-sm sm:text-base text-[#2A0912] tabular-nums">
                            {formatIDR(trackedPayment.grandTotal)}
                          </span>
                        </div>
                        <div className="rounded-xl bg-[#F9E4E8]/55 border border-[#6B1D2F]/15 p-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-[#6B1D2F]">
                              {trackedPayment.paymentScheme === 'FULL' ||
                              trackedPayment.remainingAmount === 0
                                ? 'Nominal Dibayar (Bayar Langsung)'
                                : 'Nominal DP Dibayar'}
                            </span>
                            <span className="font-bold text-base text-[#6B1D2F] tabular-nums">
                              {formatIDR(trackedPayment.dpAmount)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#2A0912]/75">
                              Sisa Pelunasan (saat pengambilan di cabang)
                            </span>
                            <span className="font-bold text-[#9B7B16] tabular-nums">
                              {formatIDR(trackedPayment.remainingAmount)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#6B1D2F]/10 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-[#2A0912]/65">
                          Butuh konfirmasi cepat dengan admin butik?
                        </span>
                        <a
                          href={buildBookingWhatsAppUrl(
                            trackedOrder,
                            siteSettings.contact.whatsappNumber,
                            dpPercentage
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-9 px-3.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-colors"
                        >
                          <MessageCircle
                            className="w-3.5 h-3.5"
                            aria-hidden="true"
                          />
                          <span>Kirim ke WhatsApp</span>
                        </a>
                      </div>
                    </article>
                  );
                })()
              ) : (
                !trackNotFoundMsg && (
                  <div className="rounded-2xl bg-white border border-[#6B1D2F]/10 p-8 text-center space-y-2.5">
                    <ReceiptText
                      className="w-8 h-8 text-[#D4AF37] mx-auto"
                      aria-hidden="true"
                    />
                    <p className="text-sm font-semibold text-[#2A0912]">
                      Privasi Pelanggan Terjaga
                    </p>
                    <p className="text-xs sm:text-sm text-[#2A0912]/65 max-w-md mx-auto leading-relaxed">
                      Detail reservasi hanya dapat diakses menggunakan kombinasi Kode Booking dan Nomor Telepon pemesan.
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'promo') {
      const activePromos = siteSettings.promos.filter((p) => p.active);

      return (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#6B1D2F]">
              Penawaran Eksklusif
            </h1>
            <p className="text-xs sm:text-sm text-[#6B1D2F]/75">
              Benefit istimewa untuk momen wisuda, lamaran, dan pernikahan Anda.
            </p>
          </div>

          {activePromos.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#6B1D2F]/12 p-8 text-center space-y-2">
              <Gift className="w-8 h-8 text-[#D4AF37] mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold text-[#2A0912]">
                Belum ada promo aktif saat ini
              </p>
              <p className="text-xs text-[#2A0912]/65">
                Nantikan penawaran spesial Tiyara Attire atau jelajahi katalog koleksi kami.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('browse')}
                className="mt-2 px-4 py-2 rounded-xl bg-[#6B1D2F] text-white text-xs font-semibold hover:bg-[#4A1220]"
              >
                Jelajahi Koleksi
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
              {activePromos.map((promo) => {
                const isHighlight = Boolean(promo.highlight);
                return (
                  <div
                    key={promo.id}
                    className={`rounded-2xl p-6 flex flex-col justify-between gap-4 ${
                      isHighlight
                        ? 'bg-[#6B1D2F] text-white'
                        : 'bg-white border border-[#6B1D2F]/12 text-[#2A0912]'
                    }`}
                  >
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            isHighlight ? 'text-[#D4AF37]' : 'text-[#6B1D2F]'
                          }`}
                        >
                          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{promo.targetCategory || 'Semua'}</span>
                        </span>
                        <span
                          className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            isHighlight
                              ? 'bg-white/10 text-[#D4AF37]'
                              : 'bg-[#F9E4E8]/70 text-[#6B1D2F]'
                          }`}
                        >
                          {promo.codeOrTerms}
                        </span>
                      </div>

                      <h2
                        className={`font-display text-xl sm:text-2xl font-bold leading-snug ${
                          isHighlight ? 'text-white' : 'text-[#2A0912]'
                        }`}
                      >
                        {promo.title}
                      </h2>
                      <p
                        className={`text-xs sm:text-sm leading-relaxed ${
                          isHighlight ? 'text-white/85' : 'text-[#2A0912]/70'
                        }`}
                      >
                        {promo.description}
                      </p>
                      {promo.validPeriod && (
                        <p
                          className={`text-[11px] font-medium ${
                            isHighlight ? 'text-[#F9E4E8]' : 'text-[#6B1D2F]/75'
                          }`}
                        >
                          {promo.validPeriod}
                        </p>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCategory(promo.targetCategory || 'Semua');
                          setActiveTab('browse');
                        }}
                        className={
                          isHighlight
                            ? 'inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-[#D4AF37] text-[#2A0912] text-xs font-bold hover:bg-[#C39E2B] transition-colors'
                            : 'text-xs font-semibold text-[#6B1D2F] underline underline-offset-4 hover:text-[#4A1220]'
                        }
                      >
                        {promo.targetCategory && promo.targetCategory !== 'Semua'
                          ? `Lihat Koleksi ${promo.targetCategory}`
                          : 'Jelajahi Semua Koleksi'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'contact') {
      const contact = siteSettings.contact;
      const cleanWa = formatWhatsAppInternational(contact.whatsappNumber, '');
      const waHref = cleanWa ? `https://wa.me/${cleanWa}` : '#';

      return (
        <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-24 md:pb-12 space-y-6">
          <div className="space-y-1">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#6B1D2F]">
              Butik &amp; Kontak Kami
            </h1>
            <p className="text-xs sm:text-sm text-[#6B1D2F]/75">
              Kunjungi lokasi pickup resmi Tiyara Attire atau hubungi layanan pelanggan.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 rounded-2xl bg-[#6B1D2F] text-white p-6 space-y-4">
              {siteSettings.brand?.logoUrl?.trim() && (
                <div className="inline-flex items-center px-3 py-2 rounded-xl bg-white shadow-xs">
                  <BrandLogo
                    logoUrl={siteSettings.brand.logoUrl}
                    brandName={siteSettings.browse.heroTitle || 'Tiyara Attire'}
                    size="sm"
                  />
                </div>
              )}
              <div className="flex items-center gap-2 text-[#D4AF37] text-xs font-semibold">
                <Phone className="w-4 h-4" aria-hidden="true" />
                <span>Concierge WhatsApp Resmi</span>
              </div>
              <p className="font-mono text-xl font-bold tracking-tight tabular-nums">
                {contact.whatsappNumber}
              </p>

              <div className="space-y-2.5 text-xs sm:text-sm text-white/85 pt-1">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{contact.boutiqueAddress}</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{contact.operationalHours}</span>
                </div>
                {contact.email && (
                  <div className="flex items-start gap-2.5">
                    <Mail className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" aria-hidden="true" />
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:underline"
                    >
                      {contact.email}
                    </a>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#2A0912] text-xs font-bold hover:bg-[#C39E2B] transition-colors"
                >
                  <MessageCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Chat WhatsApp</span>
                </a>
                {contact.instagramUrl && (
                  <a
                    href={contact.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/12 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                  >
                    <Instagram className="w-4 h-4" aria-hidden="true" />
                    <span>Instagram</span>
                  </a>
                )}
                {contact.mapsUrl && (
                  <a
                    href={contact.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white/12 text-white text-xs font-semibold hover:bg-white/20 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Google Maps</span>
                  </a>
                )}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                Lokasi Cabang Pickup Store
              </h2>
              {pickupLocations.length === 0 ? (
                <p className="text-xs text-[#2A0912]/60 bg-white p-4 rounded-xl border border-[#6B1D2F]/10">
                  Belum ada lokasi cabang terdaftar.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {pickupLocations.map((loc) => (
                    <div
                      key={loc.id}
                      className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 flex items-start gap-3"
                    >
                      <div className="w-10 h-10 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] flex items-center justify-center shrink-0">
                        <MapPin className="w-4 h-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#2A0912]">
                          {loc.name}
                        </h3>
                        <p className="text-xs text-[#2A0912]/70 mt-1 leading-relaxed">
                          {loc.address}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    // Default: Browse Tab
    return (
      <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-24 md:pb-12 space-y-8">
        {/* Hero Split Section: Search + Categories (Left) & Editorial Banner (Right) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-stretch">
          <div className="lg:col-span-5 flex flex-col justify-between gap-5">
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  {siteSettings.brand?.logoUrl?.trim() && (
                    <div className="mb-2">
                      <BrandLogo
                        logoUrl={siteSettings.brand.logoUrl}
                        brandName={siteSettings.browse.heroTitle || 'Tiyara Attire'}
                        size="md"
                      />
                    </div>
                  )}
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#6B1D2F] leading-tight text-balance">
                    {siteSettings.browse.heroTitle}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#6B1D2F]/75 mt-1">
                    {siteSettings.browse.heroSubtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className="md:hidden min-h-[40px] px-3 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] text-xs font-semibold flex items-center gap-1.5 hover:bg-[#F3D2D8] transition-colors whitespace-nowrap shrink-0"
                >
                  <ReceiptText className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Cek Pesanan</span>
                </button>
              </div>

              <div className="relative">
                <Search
                  className="w-4 h-4 text-[#6B1D2F]/50 absolute left-3.5 top-1/2 -translate-y-1/2"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={siteSettings.browse.searchPlaceholder}
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-[#6B1D2F]/15 text-sm text-[#2A0912] placeholder:text-[#6B1D2F]/45 focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>
            </div>

            {/* Circular Category Filter */}
            <div className="space-y-2">
              <p className="hidden lg:block text-xs font-semibold text-[#6B1D2F]/80">
                Pilih Kategori Acara
              </p>
              <div className="flex items-start justify-between sm:justify-start lg:justify-between gap-2 sm:gap-4 overflow-x-auto no-scrollbar py-1">
                {siteSettings.browse.categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.iconKey] || Sparkles;
                  const isActive = selectedCategory === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className="flex flex-col items-center gap-1.5 min-w-[62px] shrink-0 group focus:outline-none"
                    >
                      <span
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-150 border ${
                          isActive
                            ? 'bg-[#6B1D2F] text-[#D4AF37] border-[#D4AF37] shadow-sm scale-[1.03]'
                            : 'bg-[#F9E4E8]/80 text-[#6B1D2F] border-[#6B1D2F]/12 group-hover:bg-[#F9E4E8]'
                        }`}
                      >
                        <Icon className="w-5 h-5" aria-hidden="true" />
                      </span>
                      <span
                        className={`text-[11px] font-medium whitespace-nowrap ${
                          isActive
                            ? 'text-[#6B1D2F] font-semibold'
                            : 'text-[#2A0912]/75'
                        }`}
                      >
                        {cat.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Promo Banner */}
          <div className="lg:col-span-7">
            {(() => {
              const customBanner = (
                siteSettings.browse.bannerImageUrl || ''
              ).trim();
              const bannerSrc =
                !bannerImgFailed && customBanner
                  ? customBanner
                  : PROMO_BANNER_IMAGE;
              return (
                <div className="relative rounded-2xl overflow-hidden aspect-16/9 lg:aspect-auto lg:h-full lg:min-h-[280px] lg:max-h-[380px] bg-[#4A1220] shadow-sm">
                  <img
                    src={bannerSrc}
                    alt={
                      siteSettings.browse.bannerTitle ||
                      'Koleksi Kebaya Eksklusif Tiyara Attire'
                    }
                    onError={() => {
                      if (customBanner) setBannerImgFailed(true);
                    }}
                    className="w-full h-full object-cover object-[center_22%]"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#2A0912]/95 via-[#4A1220]/55 to-[#2A0912]/15 flex flex-col justify-end p-5 sm:p-6">
                    <span className="text-[11px] sm:text-xs font-semibold text-[#D4AF37] tracking-wide drop-shadow-xs">
                      {siteSettings.browse.bannerTag}
                    </span>
                    <h2 className="font-display text-xl sm:text-3xl font-bold text-white leading-tight mt-0.5 text-balance max-w-lg drop-shadow-xs">
                      {siteSettings.browse.bannerTitle}
                    </h2>
                    <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                      <span className="text-xs sm:text-sm text-white/90 drop-shadow-xs">
                        {siteSettings.browse.bannerSubtitle}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('promo')}
                        className="px-4 py-2 rounded-xl bg-[#D4AF37] text-[#2A0912] text-xs font-bold hover:bg-[#C39E2B] transition-colors whitespace-nowrap shrink-0 shadow-xs"
                      >
                        Lihat Promo
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </section>

        {/* Koleksi Terbaru (Horizontal Scroll on mobile, 3-6 col responsive grid on md/lg) */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#6B1D2F]">
              Koleksi Terbaru
            </h2>
            <span className="text-xs text-[#6B1D2F]/70 tabular-nums">
              {latestKebayas.length} pilihan
            </span>
          </div>

          {loading ? (
            <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-3.5 overflow-hidden">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-40 md:w-auto h-60 rounded-2xl bg-[#F9E4E8]/50 animate-pulse shrink-0"
                />
              ))}
            </div>
          ) : (
            <div className="flex md:grid md:grid-cols-3 lg:grid-cols-6 gap-3.5 sm:gap-4 overflow-x-auto md:overflow-visible no-scrollbar snap-x snap-mandatory">
              {latestKebayas.map((item) => {
                const itemSizes = parseAvailableSizes(item);
                return (
                  <div
                    key={item.id}
                    className="w-40 md:w-auto shrink-0 snap-start bg-white rounded-2xl border border-[#6B1D2F]/10 overflow-hidden hover:border-[#6B1D2F]/35 hover:shadow-sm transition-all flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="text-left flex-1 flex flex-col"
                    >
                      <div className="aspect-3/4 w-full bg-[#F9E4E8]/40 overflow-hidden">
                        <KebayaImage
                          src={item.image_url}
                          alt={item.name}
                          category={item.category}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-2.5 sm:p-3 space-y-1 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-[11px] text-[#6B1D2F]/75 truncate">
                            {item.category}
                          </p>
                          <h3 className="text-xs font-semibold text-[#2A0912] line-clamp-1 mt-0.5">
                            {item.name}
                          </h3>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {itemSizes.map((sz) => (
                              <span
                                key={sz}
                                className="px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] text-[10px] font-bold"
                              >
                                {sz}
                              </span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs font-bold text-[#6B1D2F] tabular-nums pt-1">
                          {formatIDR(item.price_per_3days)}
                          <span className="font-normal text-[10px] text-[#2A0912]/60">
                            {' '}
                            /3 hr
                          </span>
                        </p>
                      </div>
                    </button>
                    <div className="px-2.5 pb-2.5">
                      <button
                        type="button"
                        disabled={Number(item.stock) <= 0}
                        onClick={() => openQuickAddModal(item)}
                        className="w-full h-8 rounded-lg bg-[#F9E4E8]/75 hover:bg-[#F9E4E8] text-[#6B1D2F] text-[11px] font-semibold inline-flex items-center justify-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        <Plus className="w-3 h-3" aria-hidden="true" />
                        <span>Keranjang</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Rekomendasi Kebaya (Responsive 2 -> 3 -> 4 Column Grid) */}
        <section className="space-y-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#6B1D2F]">
              Rekomendasi Kebaya
            </h2>
            <span className="text-xs text-[#6B1D2F]/70 tabular-nums">
              {filteredKebayas.length} tersedia
            </span>
          </div>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-72 rounded-2xl bg-[#F9E4E8]/45 animate-pulse"
                />
              ))}
            </div>
          ) : filteredKebayas.length === 0 ? (
            <div className="rounded-2xl bg-white border border-[#6B1D2F]/10 p-8 text-center space-y-2.5">
              <p className="text-sm font-semibold text-[#2A0912]">
                Kebaya tidak ditemukan
              </p>
              <p className="text-xs text-[#6B1D2F]/70">
                Coba ubah kategori atau kata kunci pencarian Anda.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategory('Semua');
                  setSearchQuery('');
                }}
                className="px-4 py-2 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] text-xs font-semibold"
              >
                Reset Filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5 sm:gap-5">
              {filteredKebayas.map((item) => {
                const outOfStock = Number(item.stock) <= 0;
                const itemSizes = parseAvailableSizes(item);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-[#6B1D2F]/12 overflow-hidden flex flex-col hover:shadow-md hover:-translate-y-0.5 transition-all duration-150"
                  >
                    <button
                      type="button"
                      onClick={() => openDetail(item)}
                      className="text-left flex-1 flex flex-col"
                    >
                      <div className="aspect-3/4 w-full bg-[#F9E4E8]/40 overflow-hidden">
                        <KebayaImage
                          src={item.image_url}
                          alt={item.name}
                          category={item.category}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between gap-2.5">
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-1 text-[11px] text-[#6B1D2F]/75">
                            <span className="truncate">{item.category}</span>
                            <span className="inline-flex items-center gap-0.5 font-semibold text-[#9B7B16] tabular-nums shrink-0">
                              <Star
                                className="w-3 h-3 fill-[#D4AF37] text-[#D4AF37]"
                                aria-hidden="true"
                              />
                              {Number(item.rating || 4.8).toFixed(1)}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-semibold text-[#2A0912] line-clamp-2 leading-snug">
                            {item.name}
                          </h3>
                          <div className="flex flex-wrap items-center gap-1 pt-0.5">
                            <span className="text-[10px] text-[#2A0912]/60 font-medium mr-0.5">
                              Size:
                            </span>
                            {itemSizes.map((sz) => (
                              <span
                                key={sz}
                                className="px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] text-[10px] font-bold"
                              >
                                {sz}
                              </span>
                            ))}
                            <span className="text-[10px] text-[#2A0912]/55 tabular-nums ml-auto">
                              Stok {item.stock}
                            </span>
                          </div>
                        </div>
                        <div className="pt-2 border-t border-[#6B1D2F]/8 flex items-baseline justify-between gap-2">
                          <p className="text-sm sm:text-base font-bold text-[#6B1D2F] tabular-nums">
                            {formatIDR(item.price_per_3days)}
                          </p>
                          <p className="text-[10px] sm:text-[11px] text-[#2A0912]/60 whitespace-nowrap">
                            / 3 hari
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="px-3 pb-3 sm:px-4 sm:pb-4">
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => openQuickAddModal(item)}
                        className="w-full h-9 rounded-xl bg-[#F9E4E8]/80 hover:bg-[#6B1D2F] text-[#6B1D2F] hover:text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 border border-[#6B1D2F]/15 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                      >
                        <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>
                          {outOfStock ? 'Stok Habis' : '+ Tambah ke Keranjang'}
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  };

  const renderDetailScreen = () => {
    if (!selectedKebaya) return null;
    const isOutOfStock = Number(selectedKebaya.stock) <= 0;
    const maxQty = Math.max(1, Number(selectedKebaya.stock || 1));
    const detailAvailableSizes = parseAvailableSizes(selectedKebaya);

    return (
      <div className="pb-24 md:pb-12">
        <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-md border-b border-[#6B1D2F]/10 px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setScreen('tab')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#6B1D2F] hover:bg-[#F9E4E8]/60"
              aria-label="Kembali ke daftar kebaya"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold text-[#2A0912] truncate">
              Detail Kebaya
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="h-9 px-3 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F3D2D8] shrink-0"
            aria-label="Buka keranjang sewa"
          >
            <ShoppingCart className="w-4 h-4" aria-hidden="true" />
            <span>Keranjang</span>
            <span className="min-w-[20px] h-5 px-1 rounded-full bg-[#6B1D2F] text-[#D4AF37] text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
              {totalCartCount}
            </span>
          </button>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 lg:gap-10 items-start">
            {/* Left Photo Column */}
            <div className="md:col-span-5 md:sticky md:top-30">
              <div className="aspect-3/4 w-full rounded-2xl bg-[#F9E4E8]/40 overflow-hidden border border-[#6B1D2F]/10">
                <KebayaImage
                  src={selectedKebaya.image_url}
                  alt={selectedKebaya.name}
                  category={selectedKebaya.category}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Right Contiguous Purchase Module */}
            <div className="md:col-span-7 space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs sm:text-sm text-[#6B1D2F]/80">
                  <span>{selectedKebaya.category}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[#9B7B16] tabular-nums">
                    <Star
                      className="w-4 h-4 fill-[#D4AF37] text-[#D4AF37]"
                      aria-hidden="true"
                    />
                    {Number(selectedKebaya.rating || 4.8).toFixed(1)}
                  </span>
                </div>
                <h1 className="font-display text-2xl sm:text-4xl font-bold text-[#2A0912] leading-tight text-balance">
                  {selectedKebaya.name}
                </h1>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-xs font-medium text-[#2A0912]/65">
                    Size Tersedia:
                  </span>
                  {detailAvailableSizes.map((sz) => (
                    <span
                      key={sz}
                      className="px-2.5 py-0.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-xs font-bold"
                    >
                      {sz}
                    </span>
                  ))}
                </div>
                <div className="flex items-baseline gap-2 pt-1">
                  <span className="text-2xl font-bold text-[#6B1D2F] tabular-nums">
                    {formatIDR(selectedKebaya.price_per_3days)}
                  </span>
                  <span className="text-xs sm:text-sm text-[#2A0912]/65">
                    / 3 hari sewa
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-emerald-800 tabular-nums">
                  {isOutOfStock
                    ? 'Stok sedang habis disewa'
                    : `Stok tersedia: ${selectedKebaya.stock} set siap kirim`}
                </p>
              </div>

              <div className="space-y-2 border-t border-[#6B1D2F]/10 pt-5">
                <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                  Deskripsi Koleksi
                </h2>
                <p className="text-sm sm:text-base text-[#2A0912]/80 leading-relaxed">
                  {selectedKebaya.description ||
                    'Kebaya kurasi Tiyara Attire dengan material premium, jahitan butik halus, dan detail payet elegan untuk acara resmi Anda.'}
                </p>
              </div>

              {(() => {
                const kebayaOverride =
                  siteSettings.kebayaOverrides[String(selectedKebaya.id)];
                const rawBenefits =
                  selectedKebaya.rental_benefits ||
                  kebayaOverride?.rentalBenefits ||
                  siteSettings.kebayaPolicies.rentalBenefits;
                const rawTerms =
                  selectedKebaya.rental_terms ||
                  kebayaOverride?.rentalTerms ||
                  siteSettings.kebayaPolicies.rentalTerms;
                const benefitLines = rawBenefits
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);
                const termLines = rawTerms
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean);

                return (
                  <>
                    <div className="space-y-3 border-t border-[#6B1D2F]/10 pt-5">
                      <div className="flex items-center gap-2">
                        <Award
                          className="w-4 h-4 text-[#9B7B16]"
                          aria-hidden="true"
                        />
                        <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                          Benefit Penyewaan Termasuk
                        </h2>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {benefitLines.map((benefit, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3.5 rounded-xl bg-[#F9E4E8]/55 border border-[#6B1D2F]/10"
                          >
                            <ShieldCheck
                              className="w-4 h-4 text-[#6B1D2F] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <p className="text-xs sm:text-sm font-medium text-[#2A0912] leading-relaxed">
                              {benefit}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3 border-t border-[#6B1D2F]/10 pt-5">
                      <div className="flex items-center gap-2">
                        <FileText
                          className="w-4 h-4 text-[#6B1D2F]"
                          aria-hidden="true"
                        />
                        <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                          Informasi Ketentuan Sewa
                        </h2>
                      </div>
                      <div className="rounded-xl bg-white border border-[#6B1D2F]/12 p-4 space-y-2.5">
                        {termLines.map((term, idx) => (
                          <div
                            key={idx}
                            className="flex items-start gap-2.5 text-xs sm:text-sm text-[#2A0912]/80 leading-relaxed"
                          >
                            <CheckCircle2
                              className="w-4 h-4 text-[#9B7B16] shrink-0 mt-0.5"
                              aria-hidden="true"
                            />
                            <span>{term}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Pilihan Ukuran Dinamis (sesuai available_sizes) & Jumlah */}
              <div
                className={`rounded-2xl bg-white border p-4 space-y-3 ${
                  detailSizeError ? 'border-red-400' : 'border-[#6B1D2F]/12'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold text-[#6B1D2F]">
                        Pilih Size Tersedia{' '}
                        {detailAvailableSizes.length > 1 && (
                          <span className="text-red-600">*</span>
                        )}
                      </p>
                      <span className="text-[11px] text-[#2A0912]/60">
                        {detailAvailableSizes.length === 1
                          ? '(Otomatis terpilih)'
                          : detailSize
                            ? `Terpilih: ${detailSize}`
                            : '(Wajib pilih 1 ukuran)'}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {detailAvailableSizes.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setDetailSize(sz);
                            setDetailSizeError(null);
                          }}
                          className={`min-w-[44px] h-10 px-3.5 rounded-xl text-xs font-bold border transition-colors ${
                            detailSize === sz
                              ? 'bg-[#6B1D2F] text-[#D4AF37] border-[#6B1D2F]'
                              : 'bg-[#FDFBFA] text-[#2A0912] border-[#6B1D2F]/20 hover:bg-[#F9E4E8]/50'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5 shrink-0">
                    <p className="text-xs font-semibold text-[#6B1D2F]">
                      Jumlah Set
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailQty((q) => Math.max(1, q - 1))}
                        disabled={detailQty <= 1}
                        className="w-10 h-10 rounded-xl border border-[#6B1D2F]/20 bg-[#FDFBFA] text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                        aria-label="Kurangi jumlah kebaya"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="w-8 text-center font-mono text-sm font-bold text-[#2A0912] tabular-nums">
                        {detailQty}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setDetailQty((q) => Math.min(maxQty, q + 1))
                        }
                        disabled={detailQty >= maxQty}
                        className="w-10 h-10 rounded-xl border border-[#6B1D2F]/20 bg-[#FDFBFA] text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                        aria-label="Tambah jumlah kebaya"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {detailSizeError && (
                  <p
                    role="alert"
                    className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2"
                  >
                    {detailSizeError}
                  </p>
                )}
              </div>

              {/* Desktop / Tablet Inline CTA */}
              <div className="hidden md:flex flex-wrap items-center justify-between gap-4 pt-5 border-t border-[#6B1D2F]/10">
                <div>
                  <p className="text-xs text-[#2A0912]/65">
                    Bisa DP {dpPercentage}% atau Bayar Langsung · Harga / 3 Hari
                  </p>
                  <p className="text-xl font-bold text-[#6B1D2F] tabular-nums">
                    {formatIDR(selectedKebaya.price_per_3days)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={handleDetailAddToCart}
                    className="px-5 h-12 rounded-xl border-2 border-[#6B1D2F] bg-white text-[#6B1D2F] font-bold text-sm hover:bg-[#F9E4E8]/60 disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
                  >
                    <ShoppingCart className="w-4 h-4" aria-hidden="true" />
                    <span>+ Tambah ke Keranjang</span>
                  </button>
                  <button
                    type="button"
                    disabled={isOutOfStock}
                    onClick={startDirectBooking}
                    className="px-7 h-12 rounded-xl bg-[#D4AF37] text-[#2A0912] font-bold text-sm hover:bg-[#C39E2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
                  >
                    {isOutOfStock ? 'Stok Habis' : 'Sewa Sekarang'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Sticky Bottom CTA */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#6B1D2F]/12 px-4 py-3 flex items-center gap-2.5">
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={handleDetailAddToCart}
            className="h-12 px-3.5 rounded-xl border-2 border-[#6B1D2F] bg-white text-[#6B1D2F] font-bold text-xs hover:bg-[#F9E4E8]/60 disabled:opacity-50 inline-flex items-center gap-1.5 shrink-0"
          >
            <ShoppingCart className="w-4 h-4" aria-hidden="true" />
            <span>+ Keranjang</span>
          </button>
          <button
            type="button"
            disabled={isOutOfStock}
            onClick={startDirectBooking}
            className="flex-1 h-12 rounded-xl bg-[#D4AF37] text-[#2A0912] font-bold text-sm hover:bg-[#C39E2B] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
          >
            {isOutOfStock ? 'Stok Habis' : 'Sewa Sekarang'}
          </button>
        </div>
      </div>
    );
  };

  const renderBookingScreen = () => {
    if (activeBookingItems.length === 0) return null;

    return (
      <form onSubmit={handleProceedCheckout} className="pb-28 lg:pb-12">
        <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-md border-b border-[#6B1D2F]/10 px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (checkoutSource === 'cart') {
                setScreen('tab');
                setIsCartOpen(true);
              } else {
                setScreen('detail');
              }
            }}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#6B1D2F] hover:bg-[#F9E4E8]/60"
            aria-label="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#2A0912]">
            {siteSettings.bookingForm.formTitle}
          </span>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Form Column */}
            <div className="lg:col-span-7 space-y-5">
              {/* Durasi Sewa kelipatan 3 hari */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm sm:text-base font-semibold text-[#2A0912]">
                      Durasi Sewa
                    </h3>
                    <p className="text-xs text-[#2A0912]/65">
                      Kelipatan 3 hari ({durationDays / 3}x paket)
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDurationDays((d) => Math.max(3, d - 3))}
                      disabled={durationDays <= 3}
                      className="w-11 h-11 rounded-xl border border-[#6B1D2F]/20 bg-[#FDFBFA] text-[#6B1D2F] flex items-center justify-center disabled:opacity-40 hover:bg-[#F9E4E8]"
                      aria-label="Kurangi 3 hari"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-16 text-center font-mono text-sm font-bold text-[#2A0912] tabular-nums">
                      {durationDays} Hari
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setDurationDays((d) => Math.min(30, d + 3))
                      }
                      className="w-11 h-11 rounded-xl border border-[#6B1D2F]/20 bg-[#FDFBFA] text-[#6B1D2F] flex items-center justify-center hover:bg-[#F9E4E8]"
                      aria-label="Tambah 3 hari"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tanggal Mulai Sewa */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3">
                <label
                  htmlFor="booking-start-date"
                  className="block text-sm sm:text-base font-semibold text-[#2A0912]"
                >
                  Tanggal Mulai Sewa
                </label>
                <input
                  id="booking-start-date"
                  type="date"
                  min={getTodayISO()}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                  className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
                {startDate && (
                  <div className="flex items-center justify-between text-xs bg-[#F9E4E8]/55 rounded-xl px-3.5 py-2.5 text-[#6B1D2F]">
                    <span>Jadwal Pengembalian:</span>
                    <span className="font-semibold tabular-nums">
                      {formatDateID(endDate)}
                    </span>
                  </div>
                )}
              </div>

              {/* Lokasi Pengambilan Butik (Pickup Store Only) */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#6B1D2F]" aria-hidden="true" />
                  <h3 className="text-sm sm:text-base font-semibold text-[#2A0912]">
                    Pengambilan di Butik (Pickup Store)
                  </h3>
                </div>
                <p className="text-xs text-[#2A0912]/70 leading-relaxed">
                  {siteSettings.bookingForm.pickupNote}
                </p>

                <div className="space-y-2 pt-1">
                  <p className="text-xs font-medium text-[#6B1D2F]">
                    Pilih Cabang Pengambilan:
                  </p>
                  {pickupLocations.length === 0 ? (
                    <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">
                      Belum ada cabang pengambilan yang aktif saat ini. Hubungi admin butik.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
                      {pickupLocations.map((loc) => {
                        const isSelected =
                          String(effectivePickupId) === String(loc.id);
                        return (
                          <label
                            key={loc.id}
                            className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-[#F9E4E8]/60 border-[#6B1D2F]'
                                : 'bg-[#FDFBFA] border-[#6B1D2F]/12'
                            }`}
                          >
                            <input
                              type="radio"
                              name="pickup_location"
                              checked={isSelected}
                              onChange={() => setSelectedPickupId(loc.id)}
                              className="mt-1 accent-[#6B1D2F]"
                            />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-semibold text-[#2A0912]">
                                {loc.name}
                              </p>
                              <p className="text-[11px] sm:text-xs text-[#2A0912]/70 mt-0.5">
                                {loc.address}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Pilihan Skema Pembayaran (Bayar DP 50% vs Bayar Langsung) */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3">
                <h3 className="text-sm sm:text-base font-semibold text-[#2A0912]">
                  Pilihan Skema Pembayaran
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      paymentScheme === 'DP'
                        ? 'bg-[#F9E4E8]/65 border-[#6B1D2F]'
                        : 'bg-[#FDFBFA] border-[#6B1D2F]/12'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_scheme"
                      checked={paymentScheme === 'DP'}
                      onChange={() => setPaymentScheme('DP')}
                      className="mt-1 accent-[#6B1D2F]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#6B1D2F]">
                        Bayar DP ({dpPercentage}%)
                      </p>
                      <p className="text-[11px] text-[#2A0912]/70 mt-0.5 tabular-nums">
                        Bayar {formatIDR(dpAmount)} sekarang, sisa{' '}
                        {formatIDR(Math.max(0, grandTotal - dpAmount))} dilunasi di cabang.
                      </p>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors ${
                      paymentScheme === 'FULL'
                        ? 'bg-[#F9E4E8]/65 border-[#6B1D2F]'
                        : 'bg-[#FDFBFA] border-[#6B1D2F]/12'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_scheme"
                      checked={paymentScheme === 'FULL'}
                      onChange={() => setPaymentScheme('FULL')}
                      className="mt-1 accent-[#6B1D2F]"
                    />
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-bold text-[#6B1D2F]">
                        Bayar Langsung (Lunas 100%)
                      </p>
                      <p className="text-[11px] text-[#2A0912]/70 mt-0.5 tabular-nums">
                        Bayar penuh {formatIDR(grandTotal)} sekarang, tidak ada sisa tagihan.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}
            </div>

            {/* Right Sticky Summary Column */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4">
                <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                  Ringkasan Pilihan Kebaya ({activeBookingItems.length} item)
                </h2>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                  {activeBookingItems.map((item) => (
                    <div
                      key={item.cartKey}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10"
                    >
                      <KebayaImage
                        src={item.kebaya.image_url}
                        alt={item.kebaya.name}
                        category={item.kebaya.category}
                        className="w-14 h-18 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#6B1D2F]/75">
                          <span>{item.kebaya.category}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] font-bold">
                            Size {item.selectedSize}
                          </span>
                          <span>· {item.quantity} set</span>
                        </div>
                        <h3 className="text-xs sm:text-sm font-semibold text-[#2A0912] leading-snug mt-0.5 line-clamp-1">
                          {item.kebaya.name}
                        </h3>
                        <p className="text-xs font-bold text-[#6B1D2F] mt-1 tabular-nums">
                          {formatIDR(
                            Number(item.kebaya.price_per_3days) *
                              item.quantity *
                              (durationDays / 3)
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 border-t border-[#6B1D2F]/10 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between text-[#2A0912]/75">
                    <span>
                      Subtotal Sewa ({durationDays} hr · {durationDays / 3}x
                      paket)
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatIDR(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#2A0912]/75">
                    <span>Deposit Keamanan (Dikembalikan)</span>
                    <span className="font-semibold tabular-nums">
                      {formatIDR(DEPOSIT_SECURITY_FEE)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#6B1D2F]/10">
                    <span className="font-semibold text-[#2A0912]">
                      Total Harga Sewa Keseluruhan
                    </span>
                    <span className="font-bold text-[#2A0912] tabular-nums">
                      {formatIDR(grandTotal)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#F9E4E8]/60 border border-[#6B1D2F]/15 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#6B1D2F]">
                        {paymentScheme === 'FULL'
                          ? 'Bayar Langsung (Lunas 100%)'
                          : `Nominal DP (${dpPercentage}%) Dibayar Sekarang`}
                      </span>
                      <span className="text-base font-bold text-[#6B1D2F] tabular-nums">
                        {formatIDR(payableNow)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#2A0912]/75">
                        Sisa Pelunasan saat Pengambilan di Cabang
                      </span>
                      <span className="font-semibold text-[#9B7B16] tabular-nums">
                        {formatIDR(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  className="hidden lg:flex w-full h-12 rounded-xl bg-[#6B1D2F] text-white font-semibold text-sm items-center justify-center hover:bg-[#4A1220] transition-colors"
                >
                  {paymentScheme === 'FULL'
                    ? 'Lanjut Pembayaran Langsung'
                    : 'Lanjut Pembayaran DP'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Bottom Summary & Next CTA */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#6B1D2F]/12 px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-[#2A0912]/65">
              {paymentScheme === 'FULL'
                ? 'Bayar Langsung (100%)'
                : `Bayar DP (${dpPercentage}%) Sekarang`}
            </p>
            <p className="text-base font-bold text-[#6B1D2F] tabular-nums">
              {formatIDR(payableNow)}
            </p>
          </div>
          <button
            type="submit"
            className="flex-1 max-w-xs h-12 rounded-xl bg-[#6B1D2F] text-white font-semibold text-sm hover:bg-[#4A1220] transition-colors"
          >
            {paymentScheme === 'FULL' ? 'Lanjut Bayar' : 'Lanjut Pembayaran DP'}
          </button>
        </div>
      </form>
    );
  };

  const renderCheckoutScreen = () => {
    if (activeBookingItems.length === 0) return null;

    return (
      <form onSubmit={handleConfirmPayment} className="pb-28 lg:pb-12">
        <div className="sticky top-14 z-20 bg-white/95 backdrop-blur-md border-b border-[#6B1D2F]/10 px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScreen('booking')}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-[#6B1D2F] hover:bg-[#F9E4E8]/60"
            aria-label="Kembali ke form reservasi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-semibold text-[#2A0912]">
            Checkout &amp; Pembayaran
          </span>
        </div>

        <div className="px-4 sm:px-6 lg:px-8 pt-5 lg:pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            {/* Left Column: Customer Info, Transfer Info, Proof Upload */}
            <div className="lg:col-span-7 space-y-5">
              {/* Data Penyewa */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3.5">
                <div className="space-y-1">
                  <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                    Data Diri Penyewa
                  </h2>
                  <p className="text-xs text-[#2A0912]/70 leading-relaxed">
                    {siteSettings.bookingForm.customerDataNote}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label
                      htmlFor="customer-name"
                      className="block text-xs font-medium text-[#2A0912]"
                    >
                      Nama Lengkap <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="customer-name"
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Nama sesuai identitas"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="customer-phone"
                      className="block text-xs font-medium text-[#2A0912]"
                    >
                      Nomor Telepon / WhatsApp{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="customer-phone"
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0812xxxxxxxx"
                      className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>
                  <div className="sm:col-span-2 space-y-1">
                    <label
                      htmlFor="customer-address"
                      className="block text-xs font-medium text-[#2A0912]"
                    >
                      Alamat Lengkap Penyewa{' '}
                      <span className="text-red-600">*</span>
                    </label>
                    <textarea
                      id="customer-address"
                      rows={2}
                      required
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      placeholder="Masukkan alamat lengkap domisili (Jalan, RT/RW, Kelurahan, Kecamatan, Kota)"
                      className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>
                </div>
              </div>

              {/* Informasi Rekening Transfer & QRIS */}
              <div className="bg-[#4A1220] text-white rounded-2xl p-4 sm:p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-white/10 rounded-xl p-3.5 border border-[#D4AF37]/30">
                  <div>
                    <p className="text-[11px] font-semibold text-[#D4AF37]">
                      {paymentScheme === 'FULL'
                        ? 'Nominal Bayar Langsung (100%) yang Ditransfer Sekarang'
                        : `Nominal DP (${dpPercentage}%) yang Harus Ditransfer Sekarang`}
                    </p>
                    <p className="font-mono text-xl sm:text-2xl font-bold text-white tabular-nums mt-0.5">
                      {formatIDR(payableNow)}
                    </p>
                  </div>
                  <div className="text-right text-[11px] text-[#F9E4E8]/85">
                    <p>Sisa pelunasan di butik:</p>
                    <p className="font-semibold text-[#D4AF37] tabular-nums">
                      {formatIDR(remainingAmount)}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xs font-semibold text-[#D4AF37] tracking-wide">
                    Transfer ke Rekening / QRIS Resmi
                  </h2>
                  <p className="text-xs text-[#F9E4E8]/85 leading-relaxed">
                    {siteSettings.bookingForm.bankTransferNote}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-2 bg-white/10 rounded-xl p-3.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#F9E4E8] truncate">
                        {siteSettings.bookingForm.bank1Label}
                      </p>
                      <p className="font-mono text-sm font-bold tracking-wide tabular-nums mt-0.5">
                        {siteSettings.bookingForm.bank1Number}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAccount(
                          'BANK1',
                          siteSettings.bookingForm.bank1Number
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#2A0912] text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedBank === 'BANK1' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white/10 rounded-xl p-3.5">
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#F9E4E8] truncate">
                        {siteSettings.bookingForm.bank2Label}
                      </p>
                      <p className="font-mono text-sm font-bold tracking-wide tabular-nums mt-0.5 truncate">
                        {siteSettings.bookingForm.bank2Number}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyAccount(
                          'BANK2',
                          siteSettings.bookingForm.bank2Number
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-[#D4AF37] text-[#2A0912] text-xs font-bold flex items-center gap-1 shrink-0"
                    >
                      {copiedBank === 'BANK2' ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {siteSettings.bookingForm.qrisInfo && (
                  <div className="flex items-start gap-2.5 bg-white/10 rounded-xl p-3 text-xs text-[#F9E4E8]">
                    <QrCode
                      className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5"
                      aria-hidden="true"
                    />
                    <span className="leading-relaxed">
                      {siteSettings.bookingForm.qrisInfo}
                    </span>
                  </div>
                )}
              </div>

              {/* Upload Bukti Transfer */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-4 sm:p-5 space-y-3">
                <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                  {paymentScheme === 'FULL'
                    ? 'Upload Bukti Transfer Pembayaran Langsung'
                    : 'Upload Bukti Transfer DP'}
                </h2>
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#6B1D2F]/25 rounded-xl p-5 cursor-pointer bg-[#FDFBFA] hover:bg-[#F9E4E8]/40 transition-colors">
                  <Upload className="w-6 h-6 text-[#6B1D2F]" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-semibold text-[#6B1D2F] text-center">
                    {paymentProofName
                      ? `Terpilih: ${paymentProofName}`
                      : `Pilih foto / screenshot bukti transfer ${
                          paymentScheme === 'FULL' ? 'pembayaran' : 'DP'
                        }`}
                  </span>
                  <span className="text-[11px] text-[#2A0912]/55">
                    Format JPG, PNG, atau WEBP
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="sr-only"
                  />
                </label>

                {paymentProofPreview && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-emerald-800">
                      Pratinjau Bukti Transfer:
                    </p>
                    <div className="rounded-xl overflow-hidden border border-[#6B1D2F]/15 bg-[#FDFBFA] max-h-60 flex items-center justify-center">
                      <img
                        src={paymentProofPreview}
                        alt="Pratinjau bukti transfer"
                        className="max-h-60 w-auto object-contain"
                      />
                    </div>
                  </div>
                )}

                <label className="flex items-start gap-2.5 pt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={transferConfirmed}
                    onChange={(e) => setTransferConfirmed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 accent-[#6B1D2F] rounded"
                  />
                  <span className="text-xs sm:text-sm text-[#2A0912]/80 leading-relaxed">
                    Saya menyatakan telah mentransfer nominal{' '}
                    {paymentScheme === 'FULL' ? 'lunas' : 'DP'} sebesar{' '}
                    <strong className="text-[#6B1D2F] tabular-nums">
                      {formatIDR(payableNow)}
                    </strong>{' '}
                    ke rekening Tiyara Attire.
                  </span>
                </label>

                <p className="text-[11px] sm:text-xs text-[#6B1D2F]/80 bg-[#F9E4E8]/45 rounded-xl p-3 leading-relaxed">
                  {siteSettings.bookingForm.paymentConfirmationNote}
                </p>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                  {formError}
                </div>
              )}
            </div>

            {/* Right Sticky Summary Column */}
            <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-4">
              {/* Ringkasan Kebaya */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4">
                <h2 className="text-xs font-semibold text-[#6B1D2F] tracking-wide">
                  Ringkasan Penyewaan ({activeBookingItems.length} Kebaya)
                </h2>
                <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                  {activeBookingItems.map((item) => (
                    <div
                      key={item.cartKey}
                      className="flex items-start gap-3 p-2.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10"
                    >
                      <KebayaImage
                        src={item.kebaya.image_url}
                        alt={item.kebaya.name}
                        category={item.kebaya.category}
                        className="w-14 h-18 rounded-lg object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h3 className="text-xs sm:text-sm font-semibold text-[#2A0912] line-clamp-1">
                          {item.kebaya.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-[#2A0912]/70">
                          <span>{item.kebaya.category}</span>
                          <span className="px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] font-bold">
                            Size {item.selectedSize}
                          </span>
                          <span>· {item.quantity} set</span>
                        </div>
                        <p className="text-xs font-bold text-[#6B1D2F] tabular-nums">
                          {formatIDR(
                            Number(item.kebaya.price_per_3days) *
                              item.quantity *
                              (durationDays / 3)
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs space-y-1 bg-[#FDFBFA] rounded-xl p-3 border border-[#6B1D2F]/8">
                  <p className="text-[#6B1D2F] font-medium tabular-nums">
                    Jadwal: {formatDateID(startDate)} – {formatDateID(endDate)}{' '}
                    ({durationDays} hari)
                  </p>
                  <p className="text-[#2A0912]/70 leading-relaxed">
                    Pickup Store:{' '}
                    {selectedPickupLocation?.name || 'Butik Tiyara Attire'}
                  </p>
                </div>

                {/* Rincian Biaya & Pembayaran */}
                <div className="pt-3 border-t border-[#6B1D2F]/10 space-y-2 text-xs sm:text-sm">
                  <div className="flex items-center justify-between text-[#2A0912]/80">
                    <span>Subtotal Sewa ({durationDays} hari)</span>
                    <span className="font-semibold tabular-nums">
                      {formatIDR(subtotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#2A0912]/80">
                    <span>Uang Jaminan / Deposit (Dikembalikan)</span>
                    <span className="font-semibold tabular-nums">
                      {formatIDR(DEPOSIT_SECURITY_FEE)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[#6B1D2F]/10">
                    <span className="font-semibold text-[#2A0912]">
                      Total Harga Sewa Keseluruhan
                    </span>
                    <span className="font-bold text-[#2A0912] tabular-nums">
                      {formatIDR(grandTotal)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-[#F9E4E8]/60 border border-[#6B1D2F]/15 p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#6B1D2F]">
                        {paymentScheme === 'FULL'
                          ? 'Bayar Langsung (100%) Sekarang'
                          : `Nominal DP (${dpPercentage}%) Dibayar Sekarang`}
                      </span>
                      <span className="text-base sm:text-lg font-bold text-[#6B1D2F] tabular-nums">
                        {formatIDR(payableNow)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#2A0912]/75">
                        Sisa Pelunasan saat Pengambilan
                      </span>
                      <span className="font-bold text-[#9B7B16] tabular-nums">
                        {formatIDR(remainingAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="hidden lg:flex w-full h-12 rounded-xl bg-[#D4AF37] text-[#2A0912] font-bold text-sm items-center justify-center hover:bg-[#C39E2B] disabled:opacity-60 transition-colors"
                >
                  {submitting
                    ? 'Memproses Pesanan...'
                    : `Konfirmasi Pembayaran (${formatIDR(payableNow)})`}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile / Tablet Submit Sticky Bar */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#6B1D2F]/12 px-4 py-3">
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-[#D4AF37] text-[#2A0912] font-bold text-sm hover:bg-[#C39E2B] disabled:opacity-60 transition-colors"
          >
            {submitting
              ? 'Memproses Pesanan...'
              : `Konfirmasi Bayar (${formatIDR(payableNow)})`}
          </button>
        </div>
      </form>
    );
  };

  const renderSuccessScreen = () => {
    if (!createdBooking) return null;
    const rentedItems = resolveBookingItems(createdBooking);
    const payment = resolveBookingPayment(createdBooking, dpPercentage);
    const isFullPaid =
      payment.paymentScheme === 'FULL' || payment.remainingAmount === 0;
    const liveWaNumber = formatWhatsAppInternational(
      siteSettings.contact.whatsappNumber
    );
    const liveWaUrl =
      buildBookingWhatsAppUrl(
        createdBooking,
        siteSettings.contact.whatsappNumber,
        dpPercentage
      ) || createdWaUrl;

    return (
      <div className="max-w-lg mx-auto px-4 py-10 pb-24 flex flex-col items-center text-center space-y-5">
        <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <div className="space-y-1.5">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#6B1D2F]">
            Reservasi Berhasil Dikirim
          </h1>
          <p className="text-xs sm:text-sm text-[#2A0912]/70 max-w-sm mx-auto leading-relaxed">
            Pembayaran {isFullPaid ? 'lunas' : 'DP'} Anda telah tercatat dan sedang menunggu verifikasi tim admin Tiyara Attire.
          </p>
        </div>

        <div className="w-full bg-white rounded-2xl border border-[#6B1D2F]/15 p-5 space-y-3 text-left">
          <div className="flex items-center justify-between pb-2.5 border-b border-[#6B1D2F]/10 gap-3">
            <BrandLogo
              logoUrl={siteSettings.brand?.logoUrl}
              brandName={siteSettings.browse.heroTitle || 'Tiyara Attire'}
              size="sm"
            />
            <div className="text-right">
              <span className="text-[11px] text-[#2A0912]/65 block">
                Kode Booking
              </span>
              <span className="font-mono text-sm font-bold text-[#6B1D2F] tabular-nums">
                {createdBooking.booking_code}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-[#2A0912]/65">Status</span>
            <StatusBadge status={createdBooking.status} />
          </div>
          <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
            <span className="text-[#2A0912]/65">Nama Penyewa</span>
            <span className="font-semibold text-[#2A0912] text-right">
              {createdBooking.customer_name}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 text-xs sm:text-sm">
            <span className="text-[#2A0912]/65">No. WhatsApp</span>
            <span className="font-mono font-medium text-[#2A0912] tabular-nums">
              {createdBooking.customer_phone}
            </span>
          </div>
          <div className="space-y-1 text-xs">
            <span className="text-[#2A0912]/65 block">
              Kebaya Disewa ({rentedItems.length} item):
            </span>
            <div className="space-y-1">
              {rentedItems.map((it, idx) => (
                <p
                  key={`${it.kebaya_id}-${it.selected_size}-${idx}`}
                  className="font-semibold text-[#2A0912]"
                >
                  {it.quantity}x {it.kebaya_name}{' '}
                  <span className="inline-block px-1.5 py-0.5 rounded bg-[#F9E4E8] text-[#6B1D2F] text-[11px] font-bold">
                    Size {it.selected_size}
                  </span>
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-[#2A0912]/65">Periode Sewa</span>
            <span className="font-medium text-[#2A0912] tabular-nums">
              {formatDateID(createdBooking.start_date)} –{' '}
              {formatDateID(createdBooking.end_date)}
            </span>
          </div>
          <div className="flex items-start justify-between gap-4 text-xs sm:text-sm">
            <span className="text-[#2A0912]/65 shrink-0">Cabang Pengambilan</span>
            <span className="font-medium text-[#2A0912] text-right">
              {createdBooking.pickup_location?.name || 'Butik Tiyara Attire'}
            </span>
          </div>
          {(createdBooking.customer_address || createdBooking.delivery_address) && (
            <div className="flex items-start justify-between gap-4 text-xs sm:text-sm">
              <span className="text-[#2A0912]/65 shrink-0">Alamat Penyewa</span>
              <span className="font-medium text-[#2A0912] text-right">
                {createdBooking.customer_address ||
                  createdBooking.delivery_address}
              </span>
            </div>
          )}
          <div className="space-y-1.5 pt-2 border-t border-[#6B1D2F]/10 text-xs sm:text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[#2A0912]/75">
                Total Biaya Sewa Keseluruhan
              </span>
              <span className="font-semibold text-[#2A0912] tabular-nums">
                {formatIDR(payment.grandTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#6B1D2F]">
                {isFullPaid
                  ? 'Nominal Dibayar (Bayar Langsung)'
                  : `Nominal DP Dibayar (${dpPercentage}%)`}
              </span>
              <span className="font-bold text-base text-[#6B1D2F] tabular-nums">
                {formatIDR(payment.dpAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#2A0912]/75">
                Sisa Pelunasan saat Pengambilan
              </span>
              <span className="font-bold text-[#9B7B16] tabular-nums">
                {formatIDR(payment.remainingAmount)}
              </span>
            </div>
          </div>
        </div>

        {liveWaUrl && (
          <div className="w-full rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-2.5 text-center">
            <a
              href={liveWaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 px-4 rounded-xl bg-emerald-600 text-white text-xs sm:text-sm font-bold inline-flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <MessageCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Kirim Notifikasi ke WhatsApp</span>
            </a>
            <p className="text-[11px] text-emerald-900/85 leading-relaxed">
              Nomor WA Admin (Menu Kontak):{' '}
              <span className="font-mono font-bold">
                {siteSettings.contact.whatsappNumber || liveWaNumber}
              </span>{' '}
              <span className="text-emerald-800/75">
                (wa.me/{liveWaNumber})
              </span>
            </p>
            {waPopupBlocked && (
              <p className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                Pembukaan tab WhatsApp otomatis ditahan oleh browser. Klik tombol hijau di atas untuk langsung mengirim notifikasi pesanan.
              </p>
            )}
          </div>
        )}

        <div className="w-full grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('browse');
              setScreen('tab');
            }}
            className="h-11 rounded-xl border border-[#6B1D2F]/20 bg-white text-[#6B1D2F] text-xs sm:text-sm font-semibold hover:bg-[#F9E4E8]/40"
          >
            Kembali Browse
          </button>
          <button
            type="button"
            onClick={() => {
              const matchedKebaya = kebayas.find(
                (k) => String(k.id) === String(createdBooking.kebaya_id)
              );
              const matchedPickup = createdBooking.pickup_location_id
                ? pickupLocations.find(
                    (p) =>
                      String(p.id) === String(createdBooking.pickup_location_id)
                  )
                : null;
              setTrackCode(createdBooking.booking_code);
              setTrackPhone(createdBooking.customer_phone);
              setTrackNotFoundMsg(null);
              setTrackedOrder({
                ...createdBooking,
                kebaya: matchedKebaya || null,
                pickup_location: matchedPickup || null,
              });
              setActiveTab('orders');
              setScreen('tab');
            }}
            className="h-11 rounded-xl bg-[#6B1D2F] text-white text-xs sm:text-sm font-semibold hover:bg-[#4A1220]"
          >
            Lihat Pesanan Saya
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto min-h-[calc(100vh-3.5rem)] bg-[#FDFBFA] relative">
      {/* Desktop & Tablet Sub-Navigation Bar */}
      {screen === 'tab' && (
        <nav
          aria-label="Navigasi Pelanggan Desktop"
          className="hidden md:flex items-center justify-between px-6 lg:px-8 h-12 border-b border-[#6B1D2F]/10 bg-white/80 backdrop-blur-sm sticky top-14 z-20"
        >
          <div className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`h-12 inline-flex items-center gap-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'border-[#6B1D2F] text-[#6B1D2F] font-semibold'
                      : 'border-transparent text-[#2A0912]/65 hover:text-[#6B1D2F]'
                  }`}
                >
                  <Icon className="w-4 h-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-[#6B1D2F]/70 hidden lg:inline">
              DP {dpPercentage}% saat reservasi · Pelunasan di butik
            </span>
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="h-9 px-3.5 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] text-xs font-bold inline-flex items-center gap-2 hover:bg-[#F3D2D8] transition-colors"
              aria-label="Buka keranjang sewa"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              <span>Keranjang</span>
              <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-[#6B1D2F] text-[#D4AF37] text-[11px] font-bold inline-flex items-center justify-center tabular-nums">
                {totalCartCount}
              </span>
            </button>
          </div>
        </nav>
      )}

      {/* Mobile Top Quick Bar with Cart Icon + Badge */}
      {screen === 'tab' && (
        <div className="md:hidden sticky top-14 z-20 bg-white/95 backdrop-blur-md border-b border-[#6B1D2F]/10 px-4 h-11 flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-[#6B1D2F] truncate">
            Tiyara Attire · DP {dpPercentage}% Fleksibel
          </span>
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="h-8 px-3 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-xs font-bold inline-flex items-center gap-1.5 shrink-0"
            aria-label="Buka keranjang sewa"
          >
            <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Keranjang</span>
            <span className="min-w-[18px] h-4.5 px-1 rounded-full bg-[#6B1D2F] text-[#D4AF37] text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
              {totalCartCount}
            </span>
          </button>
        </div>
      )}

      {screen === 'tab' && renderTabContent()}
      {screen === 'detail' && renderDetailScreen()}
      {screen === 'booking' && renderBookingScreen()}
      {screen === 'checkout' && renderCheckoutScreen()}
      {screen === 'success' && renderSuccessScreen()}

      {/* Cart Added Toast */}
      {cartToast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40 max-w-sm bg-[#4A1220] text-white px-4 py-3 rounded-xl shadow-lg border border-[#D4AF37]/40 flex items-center justify-between gap-3">
          <span className="text-xs leading-snug">{cartToast}</span>
          <button
            type="button"
            onClick={() => {
              setCartToast(null);
              setIsCartOpen(true);
            }}
            className="px-2.5 py-1 rounded-lg bg-[#D4AF37] text-[#2A0912] text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Lihat Keranjang
          </button>
        </div>
      )}

      {/* Quick Size Picker Modal (+ Tambah ke Keranjang from Catalog) */}
      {quickAddTarget && (
        (() => {
          const modalSizes = parseAvailableSizes(quickAddTarget);
          return (
            <div
              className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4"
              onClick={() => setQuickAddTarget(null)}
            >
              <div
                className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#6B1D2F]/10 pb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <KebayaImage
                      src={quickAddTarget.image_url}
                      alt={quickAddTarget.name}
                      category={quickAddTarget.category}
                      className="w-12 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] text-[#6B1D2F]/75">
                        {quickAddTarget.category}
                      </p>
                      <h3 className="text-sm font-bold text-[#2A0912] line-clamp-2">
                        {quickAddTarget.name}
                      </h3>
                      <p className="text-xs font-bold text-[#6B1D2F] tabular-nums mt-0.5">
                        {formatIDR(quickAddTarget.price_per_3days)} / 3 hr
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickAddTarget(null)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[#6B1D2F] hover:bg-[#F9E4E8]"
                    aria-label="Tutup pilihan ukuran"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-[#6B1D2F]">
                      Pilih Size Tersedia{' '}
                      {modalSizes.length > 1 && (
                        <span className="text-red-600">*</span>
                      )}
                    </p>
                    <span className="text-[11px] text-[#2A0912]/60">
                      {modalSizes.length === 1
                        ? 'Otomatis terpilih'
                        : quickAddSize
                          ? `Dipilih: ${quickAddSize}`
                          : 'Wajib pilih 1 size'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {modalSizes.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          setQuickAddSize(sz);
                          setQuickAddError(null);
                        }}
                        className={`min-w-[48px] h-10 px-3.5 rounded-xl text-xs font-bold border transition-colors ${
                          quickAddSize === sz
                            ? 'bg-[#6B1D2F] text-[#D4AF37] border-[#6B1D2F]'
                            : 'bg-[#FDFBFA] text-[#2A0912] border-[#6B1D2F]/20 hover:bg-[#F9E4E8]/50'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                  {quickAddError && (
                    <p
                      role="alert"
                      className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5"
                    >
                      {quickAddError}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#6B1D2F]">
                    Jumlah Set (Stok {quickAddTarget.stock})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickAddQty((q) => Math.max(1, q - 1))}
                      disabled={quickAddQty <= 1}
                      className="w-9 h-9 rounded-lg border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                      aria-label="Kurangi jumlah"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono text-xs font-bold tabular-nums">
                      {quickAddQty}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setQuickAddQty((q) =>
                          Math.min(
                            Math.max(1, Number(quickAddTarget.stock || 1)),
                            q + 1
                          )
                        )
                      }
                      disabled={
                        quickAddQty >=
                        Math.max(1, Number(quickAddTarget.stock || 1))
                      }
                      className="w-9 h-9 rounded-lg border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                      aria-label="Tambah jumlah"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const chosen =
                      quickAddSize ||
                      (modalSizes.length === 1 ? modalSizes[0] : '');
                    if (!chosen || !modalSizes.includes(chosen)) {
                      setQuickAddError(
                        'Silakan pilih salah satu size yang tersedia terlebih dahulu.'
                      );
                      return;
                    }
                    addToCart(quickAddTarget, chosen, quickAddQty);
                    setQuickAddTarget(null);
                  }}
                  className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white text-xs font-bold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] transition-colors"
                >
                  <ShoppingCart className="w-4 h-4 text-[#D4AF37]" />
                  <span>Masukkan ke Keranjang</span>
                </button>
              </div>
            </div>
          );
        })()
      )}

      {/* Cart Drawer / Modal */}
      {isCartOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex justify-end"
          onClick={() => setIsCartOpen(false)}
        >
          <div
            className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-[#6B1D2F]/12 flex items-center justify-between bg-[#FDFBFA]">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-[#6B1D2F]" />
                <div>
                  <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                    Keranjang Sewa
                  </h2>
                  <p className="text-[11px] text-[#2A0912]/65 tabular-nums">
                    {totalCartCount} item kebaya dipilih
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCartOpen(false)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B1D2F] hover:bg-[#F9E4E8]"
                aria-label="Tutup keranjang"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
              {cartItems.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <ShoppingCart className="w-10 h-10 text-[#D4AF37] mx-auto" />
                  <p className="text-sm font-semibold text-[#2A0912]">
                    Keranjang sewa Anda masih kosong
                  </p>
                  <p className="text-xs text-[#2A0912]/65 max-w-xs mx-auto leading-relaxed">
                    Pilih kebaya favorit dari katalog dan tekan tombol + Tambah ke Keranjang untuk menyewa lebih dari 1 kebaya sekaligus.
                  </p>
                </div>
              ) : (
                cartItems.map((item) => {
                  const liveKebaya =
                    kebayas.find(
                      (k) => String(k.id) === String(item.kebaya.id)
                    ) || item.kebaya;
                  const itemSizes = parseAvailableSizes(liveKebaya);
                  const maxStock = Math.max(1, Number(liveKebaya.stock || 1));
                  const sizeOptions = itemSizes.includes(item.selectedSize)
                    ? itemSizes
                    : [item.selectedSize, ...itemSizes];
                  return (
                    <div
                      key={item.cartKey}
                      className="p-3.5 rounded-2xl bg-[#FDFBFA] border border-[#6B1D2F]/12 space-y-3"
                    >
                      <div className="flex items-start gap-3">
                        <KebayaImage
                          src={liveKebaya.image_url}
                          alt={liveKebaya.name}
                          category={liveKebaya.category}
                          className="w-16 h-20 rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs sm:text-sm font-bold text-[#2A0912] line-clamp-2">
                              {liveKebaya.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => removeCartItem(item.cartKey)}
                              className="p-1.5 rounded-lg text-red-700 hover:bg-red-50 shrink-0"
                              aria-label={`Hapus ${liveKebaya.name} dari keranjang`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] font-semibold text-[#6B1D2F]">
                            Size dipilih:{' '}
                            <span className="px-1.5 py-0.5 rounded bg-[#F9E4E8]">
                              {item.selectedSize}
                            </span>
                          </p>
                          <p className="text-xs font-bold text-[#6B1D2F] tabular-nums">
                            {formatIDR(liveKebaya.price_per_3days)} / 3 hr
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#6B1D2F]/10">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-[#2A0912]/70">
                            Ganti Size:
                          </span>
                          <select
                            aria-label={`Pilih ukuran ${liveKebaya.name}`}
                            value={item.selectedSize}
                            onChange={(e) =>
                              updateCartItemSize(item.cartKey, e.target.value)
                            }
                            className="h-8 px-2 rounded-lg bg-white border border-[#6B1D2F]/20 text-xs font-semibold text-[#6B1D2F]"
                          >
                            {sizeOptions.map((sz) => (
                              <option key={sz} value={sz}>
                                {sz}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => updateCartItemQty(item.cartKey, -1)}
                            className="w-8 h-8 rounded-lg border border-[#6B1D2F]/20 bg-white text-[#6B1D2F] flex items-center justify-center"
                            aria-label={`Kurangi jumlah ${liveKebaya.name}`}
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs font-bold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= maxStock}
                            onClick={() => updateCartItemQty(item.cartKey, 1)}
                            className="w-8 h-8 rounded-lg border border-[#6B1D2F]/20 bg-white text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                            aria-label={`Tambah jumlah ${liveKebaya.name}`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="p-4 sm:p-5 border-t border-[#6B1D2F]/12 bg-white space-y-3">
                {(() => {
                  const baseSub = cartItems.reduce(
                    (sum, item) =>
                      sum +
                      Number(item.kebaya.price_per_3days || 0) * item.quantity,
                    0
                  );
                  const estTotal = baseSub + DEPOSIT_SECURITY_FEE;
                  const estDp = Math.round((estTotal * dpPercentage) / 100);
                  return (
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between text-[#2A0912]/75">
                        <span>Estimasi Sewa (paket 3 hari)</span>
                        <span className="font-semibold tabular-nums">
                          {formatIDR(baseSub)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#6B1D2F]">
                        <span className="font-bold">
                          Estimasi DP ({dpPercentage}% + Deposit)
                        </span>
                        <span className="font-bold text-sm tabular-nums">
                          {formatIDR(estDp)}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <button
                  type="button"
                  onClick={handleCheckoutFromCart}
                  className="w-full h-11 rounded-xl bg-[#D4AF37] text-[#2A0912] text-sm font-bold hover:bg-[#C39E2B] transition-colors shadow-xs"
                >
                  Checkout Keranjang ({totalCartCount} Item)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar */}
      {screen === 'tab' && (
        <nav
          aria-label="Navigasi Pelanggan Mobile"
          className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-[#6B1D2F]/12"
        >
          <div className="grid grid-cols-4 h-16 items-center">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`h-full flex flex-col items-center justify-center gap-1 transition-colors ${
                    isActive
                      ? 'text-[#6B1D2F] font-semibold'
                      : 'text-[#2A0912]/55 hover:text-[#6B1D2F]'
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 ${isActive ? 'text-[#6B1D2F]' : ''}`}
                    aria-hidden="true"
                  />
                  <span className="text-[11px] leading-none whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};
