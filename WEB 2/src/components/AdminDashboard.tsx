import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Edit3,
  Eye,
  FileText,
  LayoutDashboard,
  LogOut,
  Minus,
  Package,
  Plus,
  PlusCircle,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Shirt,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
  Upload,
  Wallet,
  X,
} from 'lucide-react';
import {
  Booking,
  BookingStatus,
  BookingWithDetails,
  Kebaya,
  KebayaCategory,
  PickupLocation,
} from '../types/database';
import { SiteContentSettings } from '../types/settings';
import {
  LOCAL_KEBAYA_IMAGES,
  addDaysToISO,
  formatDateID,
  formatIDR,
  getMonthLabelID,
} from '../lib/format';
import { AdminContentSettings } from './AdminContentSettings';
import { KebayaImage } from './KebayaImage';
import { StatusBadge } from './StatusBadge';

type AdminMenu = 'overview' | 'kebayas' | 'orders' | 'content';

interface AdminDashboardProps {
  kebayas: Kebaya[];
  bookings: BookingWithDetails[];
  pickupLocations: PickupLocation[];
  loading: boolean;
  siteSettings: SiteContentSettings;
  onSaveSettings: (next: SiteContentSettings) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onUpdateBookingStatus: (
    bookingId: string | number,
    status: BookingStatus
  ) => Promise<{ success: boolean; error?: string }>;
  onUpdateBooking: (
    bookingId: string | number,
    patch: Partial<Omit<Booking, 'id'>>
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteBooking: (
    bookingId: string | number
  ) => Promise<{ success: boolean; error?: string }>;
  onAddKebaya: (payload: Omit<Kebaya, 'id'>) => Promise<{
    success: boolean;
    error?: string;
    kebaya?: Kebaya;
  }>;
  onUpdateKebaya: (
    id: string | number,
    payload: Partial<Omit<Kebaya, 'id'>>
  ) => Promise<{ success: boolean; error?: string }>;
  onDeleteKebaya: (
    id: string | number
  ) => Promise<{ success: boolean; error?: string }>;
  onAddPickupLocation: (payload: {
    name: string;
    address: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onUpdatePickupLocation: (
    id: string | number,
    payload: { name: string; address: string }
  ) => Promise<{ success: boolean; error?: string }>;
  onDeletePickupLocation: (
    id: string | number
  ) => Promise<{ success: boolean; error?: string }>;
  onTogglePickupActive: (id: string | number) => void;
}

const BOOKING_STATUSES: BookingStatus[] = [
  'Pending Verification',
  'Confirmed',
  'Rented',
  'Returned',
];

const CATEGORY_OPTIONS: KebayaCategory[] = [
  'Wisuda',
  'Lamaran',
  'Akad Nikah',
  'Kondangan',
];

const DONUT_COLORS: Record<string, string> = {
  'Akad Nikah': '#6B1D2F',
  Wisuda: '#D4AF37',
  Lamaran: '#D97B93',
  Kondangan: '#9B4D63',
};

function compressKebayaImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 720;
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
        resolve(canvas.toDataURL('image/jpeg', 0.78));
      };
      img.onerror = () => resolve(String(reader.result));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  kebayas,
  bookings,
  pickupLocations,
  loading,
  siteSettings,
  onSaveSettings,
  onRefresh,
  onLogout,
  onUpdateBookingStatus,
  onUpdateBooking,
  onDeleteBooking,
  onAddKebaya,
  onUpdateKebaya,
  onDeleteKebaya,
  onAddPickupLocation,
  onUpdatePickupLocation,
  onDeletePickupLocation,
  onTogglePickupActive,
}) => {
  const [activeMenu, setActiveMenu] = useState<AdminMenu>('overview');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('Semua');
  const [orderSearch, setOrderSearch] = useState<string>('');
  const [updatingId, setUpdatingId] = useState<string | number | null>(null);
  const [statusFeedback, setStatusFeedback] = useState<string | null>(null);
  const [proofModalUrl, setProofModalUrl] = useState<string | null>(null);
  const [proofModalCode, setProofModalCode] = useState<string>('');

  // Edit & Delete Booking Modal State
  const [editBookingTarget, setEditBookingTarget] =
    useState<BookingWithDetails | null>(null);
  const [editStatus, setEditStatus] = useState<BookingStatus>(
    'Pending Verification'
  );
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editPickupId, setEditPickupId] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editDurationDays, setEditDurationDays] = useState('3');
  const [editSubtotal, setEditSubtotal] = useState('0');
  const [editDeposit, setEditDeposit] = useState('100000');
  const [editGrandTotal, setEditGrandTotal] = useState('0');
  const [savingEditBooking, setSavingEditBooking] = useState(false);
  const [editBookingError, setEditBookingError] = useState<string | null>(null);

  const [deleteBookingTarget, setDeleteBookingTarget] =
    useState<BookingWithDetails | null>(null);
  const [deletingBooking, setDeletingBooking] = useState(false);

  // Add / Edit Kebaya Form State
  const [editingKebayaId, setEditingKebayaId] = useState<string | number | null>(
    null
  );
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<KebayaCategory>('Wisuda');
  const [newSize, setNewSize] = useState('M / L');
  const [newPrice, setNewPrice] = useState('450000');
  const [newStock, setNewStock] = useState('3');
  const [newRating, setNewRating] = useState('4.9');
  const [newImageUrl, setNewImageUrl] = useState(LOCAL_KEBAYA_IMAGES.Wisuda);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [newDescription, setNewDescription] = useState('');
  const [newBenefits, setNewBenefits] = useState(
    siteSettings.kebayaPolicies.rentalBenefits
  );
  const [newTerms, setNewTerms] = useState(
    siteSettings.kebayaPolicies.rentalTerms
  );
  const [addingKebaya, setAddingKebaya] = useState(false);
  const [kebayaFormMsg, setKebayaFormMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Global Default Benefit & Ketentuan Sewa inside Manajemen Kebaya
  const [defaultBenefitsDraft, setDefaultBenefitsDraft] = useState(
    siteSettings.kebayaPolicies.rentalBenefits
  );
  const [defaultTermsDraft, setDefaultTermsDraft] = useState(
    siteSettings.kebayaPolicies.rentalTerms
  );
  const [policySavedMsg, setPolicySavedMsg] = useState<string | null>(null);

  // Delete Kebaya Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<Kebaya | null>(null);
  const [deletingKebaya, setDeletingKebaya] = useState<boolean>(false);
  const [inventoryMsg, setInventoryMsg] = useState<string | null>(null);

  // KPI Metrics
  const kpis = useMemo(() => {
    const totalTransactions = bookings.length;
    const totalDays = bookings.reduce(
      (sum, b) => sum + Number(b.duration_days || 0),
      0
    );
    const avgDuration =
      totalTransactions > 0 ? (totalDays / totalTransactions).toFixed(1) : '0.0';
    const totalRevenue = bookings.reduce(
      (sum, b) => sum + Number(b.subtotal ?? b.grand_total ?? 0),
      0
    );
    const activeRentals = bookings.filter(
      (b) => b.status === 'Rented' || b.status === 'Confirmed'
    ).length;

    return {
      totalTransactions,
      avgDuration,
      totalRevenue,
      activeRentals,
    };
  }, [bookings]);

  // Monthly Revenue & Booking Count Charts
  const monthlyData = useMemo(() => {
    const map = new Map<
      string,
      { key: string; month: string; revenue: number; count: number }
    >();

    bookings.forEach((b) => {
      const { key, label } = getMonthLabelID(b.start_date || b.created_at);
      const current = map.get(key) || {
        key,
        month: label,
        revenue: 0,
        count: 0,
      };
      current.revenue += Number(b.subtotal ?? b.grand_total ?? 0);
      current.count += 1;
      map.set(key, current);
    });

    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key));
  }, [bookings]);

  // Category Composition Donut Chart
  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    CATEGORY_OPTIONS.forEach((cat) => counts.set(cat, 0));

    bookings.forEach((b) => {
      const cat = b.kebaya?.category || 'Lainnya';
      counts.set(cat, (counts.get(cat) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .filter((entry) => entry.value > 0);
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesStatus =
        orderStatusFilter === 'Semua' || b.status === orderStatusFilter;
      const q = orderSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        b.booking_code.toLowerCase().includes(q) ||
        b.customer_name.toLowerCase().includes(q) ||
        (b.kebaya?.name || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [bookings, orderStatusFilter, orderSearch]);

  const handleStatusChange = async (
    bookingId: string | number | undefined,
    nextStatus: BookingStatus
  ) => {
    if (bookingId === undefined || bookingId === null) return;
    setUpdatingId(bookingId);
    setStatusFeedback(null);
    const res = await onUpdateBookingStatus(bookingId, nextStatus);
    setUpdatingId(null);
    if (res.success) {
      setStatusFeedback(`Status pesanan berhasil diperbarui ke "${nextStatus}".`);
    } else {
      setStatusFeedback(res.error || 'Gagal memperbarui status pesanan.');
    }
  };

  const openEditBookingModal = (order: BookingWithDetails) => {
    setEditBookingTarget(order);
    setEditStatus(order.status);
    setEditCustomerName(order.customer_name || '');
    setEditCustomerPhone(order.customer_phone || '');
    setEditCustomerAddress(
      order.customer_address || order.delivery_address || ''
    );
    setEditPickupId(
      order.pickup_location_id !== null && order.pickup_location_id !== undefined
        ? String(order.pickup_location_id)
        : ''
    );
    setEditStartDate(order.start_date || '');
    setEditEndDate(order.end_date || '');
    setEditDurationDays(String(order.duration_days || 3));
    setEditSubtotal(String(order.subtotal ?? 0));
    setEditDeposit(String(order.deposit_security ?? 100000));
    setEditGrandTotal(String(order.grand_total ?? 0));
    setEditBookingError(null);
  };

  const handleEditBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editBookingTarget || editBookingTarget.id === undefined) return;
    setEditBookingError(null);

    if (editCustomerName.trim().length < 2) {
      setEditBookingError('Nama penyewa wajib diisi.');
      return;
    }
    if (editCustomerPhone.trim().length < 6) {
      setEditBookingError('Nomor telepon penyewa wajib diisi.');
      return;
    }

    const durNum = Math.max(1, Number(editDurationDays) || 3);
    const subNum = Math.max(0, Number(editSubtotal) || 0);
    const depNum = Math.max(0, Number(editDeposit) || 0);
    const grandNum = Math.max(0, Number(editGrandTotal) || subNum + depNum);
    const cleanAddr = editCustomerAddress.trim();

    setSavingEditBooking(true);
    const res = await onUpdateBooking(editBookingTarget.id, {
      status: editStatus,
      customer_name: editCustomerName.trim(),
      customer_phone: editCustomerPhone.trim(),
      customer_address: cleanAddr || null,
      delivery_address: cleanAddr || null,
      pickup_location_id: editPickupId ? editPickupId : null,
      start_date: editStartDate,
      end_date: editEndDate,
      duration_days: durNum,
      subtotal: subNum,
      deposit_security: depNum,
      grand_total: grandNum,
    });
    setSavingEditBooking(false);

    if (res.success) {
      setStatusFeedback(
        `Data pesanan ${editBookingTarget.booking_code} berhasil diperbarui.`
      );
      setEditBookingTarget(null);
    } else {
      setEditBookingError(res.error || 'Gagal menyimpan perubahan pesanan.');
    }
  };

  const handleConfirmDeleteBooking = async () => {
    if (!deleteBookingTarget || deleteBookingTarget.id === undefined) return;
    setDeletingBooking(true);
    const res = await onDeleteBooking(deleteBookingTarget.id);
    setDeletingBooking(false);
    if (res.success) {
      setStatusFeedback(
        `Pesanan ${deleteBookingTarget.booking_code} berhasil dihapus.`
      );
    } else {
      setStatusFeedback(res.error || 'Gagal menghapus pesanan.');
    }
    setDeleteBookingTarget(null);
  };

  const resetKebayaForm = () => {
    setEditingKebayaId(null);
    setNewName('');
    setNewCategory('Wisuda');
    setNewSize('M / L');
    setNewPrice('450000');
    setNewStock('3');
    setNewRating('4.9');
    setNewImageUrl(LOCAL_KEBAYA_IMAGES.Wisuda);
    setUploadedFileName('');
    setNewDescription('');
    setNewBenefits(siteSettings.kebayaPolicies.rentalBenefits);
    setNewTerms(siteSettings.kebayaPolicies.rentalTerms);
  };

  const handleKebayaPhotoUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressKebayaImage(file);
      setNewImageUrl(dataUrl);
      setUploadedFileName(file.name);
      setKebayaFormMsg(null);
    } catch {
      setKebayaFormMsg({
        type: 'error',
        text: 'Gagal membaca foto kebaya dari perangkat.',
      });
    }
  };

  const handleKebayaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setKebayaFormMsg(null);

    if (newName.trim().length < 3) {
      setKebayaFormMsg({
        type: 'error',
        text: 'Nama koleksi kebaya minimal 3 karakter.',
      });
      return;
    }

    const priceNum = Number(newPrice);
    const stockNum = Number(newStock);
    const ratingNum = Number(newRating);

    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setKebayaFormMsg({
        type: 'error',
        text: 'Harga sewa per 3 hari harus lebih dari 0.',
      });
      return;
    }

    const finalBenefits =
      newBenefits.trim() || siteSettings.kebayaPolicies.rentalBenefits;
    const finalTerms =
      newTerms.trim() || siteSettings.kebayaPolicies.rentalTerms;

    const payload: Omit<Kebaya, 'id'> = {
      name: newName.trim(),
      category: newCategory,
      size: newSize.trim() || 'M',
      price_per_3days: priceNum,
      stock: Number.isNaN(stockNum) ? 1 : Math.max(0, stockNum),
      rating: Number.isNaN(ratingNum)
        ? 4.9
        : Math.min(5, Math.max(1, ratingNum)),
      image_url:
        newImageUrl.trim() ||
        LOCAL_KEBAYA_IMAGES[newCategory] ||
        LOCAL_KEBAYA_IMAGES.Wisuda,
      description:
        newDescription.trim() ||
        `Koleksi ${newCategory} eksklusif Tiyara Attire dengan bahan pilihan dan payet halus.`,
      rental_benefits: finalBenefits,
      rental_terms: finalTerms,
    };

    setAddingKebaya(true);
    if (editingKebayaId !== null) {
      const targetId = editingKebayaId;
      const res = await onUpdateKebaya(targetId, payload);
      setAddingKebaya(false);
      if (res.success) {
        onSaveSettings({
          ...siteSettings,
          kebayaOverrides: {
            ...siteSettings.kebayaOverrides,
            [String(targetId)]: {
              rentalBenefits: finalBenefits,
              rentalTerms: finalTerms,
            },
          },
        });
        setKebayaFormMsg({
          type: 'success',
          text: `Koleksi "${payload.name}" beserta benefit & ketentuan sewanya berhasil diperbarui.`,
        });
        resetKebayaForm();
      } else {
        setKebayaFormMsg({
          type: 'error',
          text: res.error || 'Gagal memperbarui kebaya.',
        });
      }
      return;
    }

    const res = await onAddKebaya(payload);
    setAddingKebaya(false);

    if (res.success) {
      if (res.kebaya?.id !== undefined) {
        onSaveSettings({
          ...siteSettings,
          kebayaOverrides: {
            ...siteSettings.kebayaOverrides,
            [String(res.kebaya.id)]: {
              rentalBenefits: finalBenefits,
              rentalTerms: finalTerms,
            },
          },
        });
      }
      setKebayaFormMsg({
        type: 'success',
        text: `Koleksi "${payload.name}" berhasil ditambahkan ke katalog Supabase.`,
      });
      resetKebayaForm();
    } else {
      setKebayaFormMsg({
        type: 'error',
        text: res.error || 'Gagal menambahkan kebaya baru.',
      });
    }
  };

  const handleSaveDefaultPolicies = (e: React.FormEvent) => {
    e.preventDefault();
    const nextBenefits =
      defaultBenefitsDraft.trim() || siteSettings.kebayaPolicies.rentalBenefits;
    const nextTerms =
      defaultTermsDraft.trim() || siteSettings.kebayaPolicies.rentalTerms;

    onSaveSettings({
      ...siteSettings,
      kebayaPolicies: {
        rentalBenefits: nextBenefits,
        rentalTerms: nextTerms,
      },
    });
    if (editingKebayaId === null) {
      setNewBenefits(nextBenefits);
      setNewTerms(nextTerms);
    }
    setPolicySavedMsg(
      'Pengaturan default Benefit Penyewaan & Ketentuan Sewa berhasil disimpan.'
    );
  };

  const handleAdjustStock = async (item: Kebaya, delta: number) => {
    const nextStock = Math.max(0, Number(item.stock || 0) + delta);
    const res = await onUpdateKebaya(item.id, { stock: nextStock });
    if (res.success) {
      setInventoryMsg(`Stok "${item.name}" diperbarui menjadi ${nextStock}.`);
    } else {
      setInventoryMsg(res.error || 'Gagal memperbarui stok kebaya.');
    }
  };

  const handleConfirmDeleteKebaya = async () => {
    if (!deleteTarget) return;
    setDeletingKebaya(true);
    const res = await onDeleteKebaya(deleteTarget.id);
    setDeletingKebaya(false);
    if (res.success) {
      setInventoryMsg(`Koleksi "${deleteTarget.name}" telah dihapus.`);
      if (String(editingKebayaId) === String(deleteTarget.id)) {
        resetKebayaForm();
      }
    } else {
      setInventoryMsg(
        res.error ||
          'Gagal menghapus kebaya (pastikan tidak terikat pesanan aktif).'
      );
    }
    setDeleteTarget(null);
  };

  const renderOrdersTable = (compact = false) => {
    const rows = compact ? filteredBookings.slice(0, 8) : filteredBookings;

    return (
      <section className="bg-white rounded-2xl border border-[#6B1D2F]/12 overflow-hidden">
        <div className="p-5 border-b border-[#6B1D2F]/10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
              Manajemen &amp; Verifikasi Pesanan
            </h2>
            <p className="text-xs text-[#2A0912]/65 mt-0.5">
              Perbarui status sewa secara real-time dari Pending Verification hingga Returned.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search
                className="w-4 h-4 text-[#6B1D2F]/50 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden="true"
              />
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                placeholder="Cari kode / penyewa..."
                className="h-9 pl-9 pr-3 rounded-lg bg-[#FDFBFA] border border-[#6B1D2F]/15 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F9E4E8]/55 overflow-x-auto">
              {['Semua', ...BOOKING_STATUSES].map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setOrderStatusFilter(st)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    orderStatusFilter === st
                      ? 'bg-[#6B1D2F] text-white'
                      : 'text-[#6B1D2F]/80 hover:text-[#6B1D2F]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {statusFeedback && (
          <div className="px-5 py-2.5 bg-[#F9E4E8]/60 border-b border-[#6B1D2F]/10 text-xs font-medium text-[#6B1D2F] flex items-center justify-between">
            <span>{statusFeedback}</span>
            <button
              type="button"
              onClick={() => setStatusFeedback(null)}
              className="text-[#6B1D2F]/70 hover:text-[#6B1D2F]"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Mobile Order Cards */}
        <div className="md:hidden divide-y divide-[#6B1D2F]/10">
          {rows.length === 0 ? (
            <div className="py-10 px-4 text-center text-xs text-[#2A0912]/60">
              Tidak ada transaksi pesanan yang sesuai dengan filter.
            </div>
          ) : (
            rows.map((order) => (
              <div
                key={order.id ?? order.booking_code}
                className="p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#6B1D2F] tabular-nums">
                      {order.booking_code}
                    </span>
                    <p className="text-xs font-semibold text-[#2A0912] mt-0.5">
                      {order.customer_name} ·{' '}
                      <span className="font-mono font-normal text-[#2A0912]/70 tabular-nums">
                        {order.customer_phone}
                      </span>
                    </p>
                    {(order.customer_address || order.delivery_address) && (
                      <p className="text-[11px] text-[#2A0912]/70 mt-0.5 leading-snug">
                        Alamat: {order.customer_address || order.delivery_address}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                <div className="text-xs space-y-1 bg-[#FDFBFA] rounded-xl p-3 border border-[#6B1D2F]/8">
                  <p className="font-semibold text-[#2A0912]">
                    {order.kebaya?.name || `Kebaya #${order.kebaya_id}`}
                  </p>
                  <p className="text-[#6B1D2F]/75 tabular-nums">
                    {formatDateID(order.start_date)} –{' '}
                    {formatDateID(order.end_date)} ({order.duration_days} hari)
                  </p>
                  <p className="text-[#2A0912]/70">
                    Pickup Store
                    {order.pickup_location?.name
                      ? ` · ${order.pickup_location.name}`
                      : ' · Butik Tiyara Attire'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#6B1D2F] tabular-nums">
                      {formatIDR(order.grand_total)}
                    </span>
                    {order.payment_proof_url && (
                      <button
                        type="button"
                        onClick={() => {
                          setProofModalUrl(order.payment_proof_url);
                          setProofModalCode(order.booking_code);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Bukti</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <select
                      aria-label={`Ubah status pesanan ${order.booking_code}`}
                      value={order.status}
                      disabled={updatingId === order.id}
                      onChange={(e) =>
                        handleStatusChange(order.id, e.target.value)
                      }
                      className="h-9 px-2.5 rounded-lg border border-[#6B1D2F]/20 bg-white text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F] disabled:opacity-50"
                    >
                      {BOOKING_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => openEditBookingModal(order)}
                      className="h-9 px-2.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-xs font-semibold inline-flex items-center gap-1 hover:bg-[#F3D2D8]"
                      aria-label={`Edit pesanan ${order.booking_code}`}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteBookingTarget(order)}
                      className="h-9 px-2.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1 hover:bg-red-100"
                      aria-label={`Hapus pesanan ${order.booking_code}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop & Tablet Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#6B1D2F]/10 bg-[#FDFBFA] text-[11px] font-semibold text-[#6B1D2F]/80">
                <th className="py-3 px-4 whitespace-nowrap">Kode Booking</th>
                <th className="py-3 px-4 whitespace-nowrap">Penyewa</th>
                <th className="py-3 px-4 whitespace-nowrap">Koleksi Kebaya</th>
                <th className="py-3 px-4 whitespace-nowrap">Jadwal Sewa</th>
                <th className="py-3 px-4 whitespace-nowrap">Pengambilan</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">
                  Grand Total
                </th>
                <th className="py-3 px-4 whitespace-nowrap">Bukti</th>
                <th className="py-3 px-4 whitespace-nowrap">Status &amp; Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#6B1D2F]/8 text-xs">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-[#2A0912]/60"
                  >
                    Tidak ada transaksi pesanan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                rows.map((order) => (
                  <tr
                    key={order.id ?? order.booking_code}
                    className="hover:bg-[#F9E4E8]/25 transition-colors"
                  >
                    <td className="py-3.5 px-4 font-mono font-semibold text-[#6B1D2F] tabular-nums whitespace-nowrap">
                      {order.booking_code}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#2A0912] whitespace-nowrap">
                        {order.customer_name}
                      </p>
                      <p className="text-[11px] text-[#2A0912]/60 font-mono tabular-nums">
                        {order.customer_phone}
                      </p>
                      {(order.customer_address || order.delivery_address) && (
                        <p
                          title={
                            order.customer_address ||
                            order.delivery_address ||
                            ''
                          }
                          className="text-[11px] text-[#2A0912]/65 max-w-[200px] truncate mt-0.5"
                        >
                          {order.customer_address || order.delivery_address}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#2A0912] max-w-[200px] truncate">
                        {order.kebaya?.name || `Kebaya #${order.kebaya_id}`}
                      </p>
                      <p className="text-[11px] text-[#6B1D2F]/70">
                        {order.kebaya?.category || 'Koleksi'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap tabular-nums">
                      <p className="text-[#2A0912]">
                        {formatDateID(order.start_date)} –{' '}
                        {formatDateID(order.end_date)}
                      </p>
                      <p className="text-[11px] text-[#2A0912]/60">
                        Durasi {order.duration_days} hari
                      </p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-[#2A0912] whitespace-nowrap">
                        Pickup Store
                      </p>
                      <p className="text-[11px] text-[#2A0912]/60 max-w-[180px] truncate">
                        {order.pickup_location?.name || 'Butik Tiyara Attire'}
                      </p>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#6B1D2F] tabular-nums whitespace-nowrap">
                      {formatIDR(order.grand_total)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {order.payment_proof_url ? (
                        <button
                          type="button"
                          onClick={() => {
                            setProofModalUrl(order.payment_proof_url);
                            setProofModalCode(order.booking_code);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] font-medium hover:bg-[#F3D2D8] transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Lihat</span>
                        </button>
                      ) : (
                        <span className="text-[#2A0912]/40">-</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={order.status} />
                        <select
                          aria-label={`Ubah status pesanan ${order.booking_code}`}
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) =>
                            handleStatusChange(order.id, e.target.value)
                          }
                          className="h-8 px-2 rounded-lg border border-[#6B1D2F]/20 bg-white text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F] disabled:opacity-50"
                        >
                          {BOOKING_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openEditBookingModal(order)}
                          className="p-2 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] hover:bg-[#F3D2D8]"
                          title="Edit pesanan"
                          aria-label={`Edit pesanan ${order.booking_code}`}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteBookingTarget(order)}
                          className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                          title="Hapus pesanan"
                          aria-label={`Hapus pesanan ${order.booking_code}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-[1440px] mx-auto min-h-[calc(100vh-3.5rem)] flex flex-col lg:flex-row">
      {/* Left Sidebar */}
      <aside className="w-full lg:w-64 shrink-0 bg-[#4A1220] text-white lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] p-4 lg:p-5 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="pb-4 border-b border-white/10">
            <p className="text-[11px] font-semibold text-[#D4AF37] tracking-wide">
              Panel Analitik &amp; Operasional
            </p>
            <h2 className="font-display text-2xl font-bold text-white mt-0.5">
              Tiyara Studio Admin
            </h2>
          </div>

          <nav
            aria-label="Menu Admin Dashboard"
            className="flex lg:flex-col gap-1.5 overflow-x-auto no-scrollbar"
          >
            {[
              {
                id: 'overview' as const,
                label: 'Dashboard Utama',
                icon: LayoutDashboard,
              },
              {
                id: 'kebayas' as const,
                label: 'Manajemen Kebaya',
                icon: Shirt,
              },
              {
                id: 'orders' as const,
                label: 'Verifikasi Pesanan',
                icon: ClipboardCheck,
              },
              {
                id: 'content' as const,
                label: 'Pengaturan Tampilan & Konten',
                icon: SlidersHorizontal,
              },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveMenu(item.id)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-[#D4AF37] text-[#2A0912] font-semibold'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-5 border-t border-white/10 space-y-4">
          <div className="text-xs text-white/70 space-y-1">
            <p className="font-semibold text-[#F9E4E8]">Ringkasan Inventori</p>
            <p className="tabular-nums">{kebayas.length} model kebaya aktif</p>
            <p className="tabular-nums">
              {bookings.filter((b) => b.status === 'Pending Verification').length}{' '}
              menunggu verifikasi
            </p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F9E4E8] text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors border border-white/15"
          >
            <LogOut className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <main className="flex-1 min-w-0 p-5 lg:p-8 space-y-6 bg-[#FDFBFA]">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#6B1D2F]/12">
          <div className="space-y-1">
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-[#6B1D2F] text-balance">
              Exploration Data Analysis (EDA) Penyewaan Kebaya Tiyara Attire
            </h1>
            <p className="text-sm text-[#2A0912]/70 max-w-3xl">
              Ringkasan historis penyewaan, tren pendapatan bulanan, komposisi kategori favorit, serta kendali inventori dan verifikasi transaksi secara real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="h-10 px-4 rounded-xl bg-white border border-[#6B1D2F]/20 text-[#6B1D2F] text-xs font-semibold inline-flex items-center gap-2 hover:bg-[#F9E4E8]/50 transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>Segarkan Data</span>
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="h-10 px-4 rounded-xl bg-[#6B1D2F] text-white text-xs font-semibold inline-flex items-center gap-2 hover:bg-[#4A1220] transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5 text-[#D4AF37]" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        {activeMenu === 'overview' && (
          <>
            {/* 4 KPI Cards (Dark Maroon with Gold & White text) */}
            <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-[#4A1220] text-white p-5 space-y-2 border border-[#D4AF37]/25">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#F9E4E8]/85">
                    Total Transaksi Sewa
                  </span>
                  <TrendingUp
                    className="w-4 h-4 text-[#D4AF37]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-mono text-3xl font-bold text-[#D4AF37] tabular-nums">
                  {kpis.totalTransactions}
                </p>
                <p className="text-[11px] text-white/70">
                  Akumulasi seluruh reservasi tercatat
                </p>
              </div>

              <div className="rounded-2xl bg-[#4A1220] text-white p-5 space-y-2 border border-[#D4AF37]/25">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#F9E4E8]/85">
                    Rata-rata Durasi Sewa (Hari)
                  </span>
                  <Clock className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
                </div>
                <p className="font-mono text-3xl font-bold text-white tabular-nums">
                  {kpis.avgDuration} <span className="text-base font-normal text-[#D4AF37]">Hari</span>
                </p>
                <p className="text-[11px] text-white/70">
                  Basis kelipatan paket 3 hari
                </p>
              </div>

              <div className="rounded-2xl bg-[#4A1220] text-white p-5 space-y-2 border border-[#D4AF37]/25">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#F9E4E8]/85">
                    Total Pendapatan (Rp)
                  </span>
                  <Wallet
                    className="w-4 h-4 text-[#D4AF37]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-mono text-2xl font-bold text-[#D4AF37] tabular-nums truncate">
                  {formatIDR(kpis.totalRevenue)}
                </p>
                <p className="text-[11px] text-white/70">
                  Subtotal sewa di luar deposit jaminan
                </p>
              </div>

              <div className="rounded-2xl bg-[#4A1220] text-white p-5 space-y-2 border border-[#D4AF37]/25">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[#F9E4E8]/85">
                    Kebaya Sedang Disewa
                  </span>
                  <Package
                    className="w-4 h-4 text-[#D4AF37]"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-mono text-3xl font-bold text-white tabular-nums">
                  {kpis.activeRentals}
                </p>
                <p className="text-[11px] text-white/70">
                  Status Confirmed &amp; Rented aktif
                </p>
              </div>
            </section>

            {/* 3 Recharts Analytics Charts */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {/* 1. Line Chart: Tren Pendapatan Bulanan */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-3 min-w-0">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#6B1D2F]">
                    Tren Pendapatan Bulanan
                  </h2>
                  <p className="text-xs text-[#2A0912]/60">
                    Total pendapatan sewa per bulan (Rp)
                  </p>
                </div>
                <div className="h-64 w-full min-w-0">
                  {monthlyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#2A0912]/50">
                      Belum ada data transaksi bulanan.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={monthlyData}
                        margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#6B1D2F"
                          strokeOpacity={0.08}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#4A1220' }}
                          axisLine={{ stroke: '#E5D5D8' }}
                          tickLine={false}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: '#4A1220' }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) =>
                            v >= 1000000
                              ? `${(v / 1000000).toFixed(1)}jt`
                              : `${Math.round(v / 1000)}rb`
                          }
                        />
                        <Tooltip
                          formatter={(value) => [
                            formatIDR(Number(value ?? 0)),
                            'Pendapatan',
                          ]}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid rgba(107,29,47,0.18)',
                            fontSize: '12px',
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="#6B1D2F"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#D4AF37', stroke: '#6B1D2F', strokeWidth: 2 }}
                          activeDot={{ r: 6, fill: '#6B1D2F' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 2. Bar Chart: Jumlah Penyewaan per Bulan */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-3 min-w-0">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#6B1D2F]">
                    Jumlah Penyewaan per Bulan
                  </h2>
                  <p className="text-xs text-[#2A0912]/60">
                    Frekuensi reservasi pelanggan tiap bulan
                  </p>
                </div>
                <div className="h-64 w-full min-w-0">
                  {monthlyData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#2A0912]/50">
                      Belum ada data frekuensi bulanan.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={monthlyData}
                        margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#6B1D2F"
                          strokeOpacity={0.08}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: '#4A1220' }}
                          axisLine={{ stroke: '#E5D5D8' }}
                          tickLine={false}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 11, fill: '#4A1220' }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value) => [
                            `${Number(value ?? 0)} transaksi`,
                            'Jumlah Sewa',
                          ]}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid rgba(107,29,47,0.18)',
                            fontSize: '12px',
                          }}
                        />
                        <Bar
                          dataKey="count"
                          fill="#D4AF37"
                          radius={[6, 6, 0, 0]}
                          maxBarSize={42}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* 3. Donut Chart: Komposisi Penyewaan berdasarkan Kategori */}
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-3 min-w-0 md:col-span-2 xl:col-span-1">
                <div>
                  <h2 className="font-display text-lg font-bold text-[#6B1D2F]">
                    Komposisi per Kategori
                  </h2>
                  <p className="text-xs text-[#2A0912]/60">
                    Proporsi akad nikah, wisuda, lamaran &amp; kondangan
                  </p>
                </div>
                <div className="h-64 w-full min-w-0">
                  {categoryData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-[#2A0912]/50">
                      Belum ada distribusi kategori.
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="46%"
                          innerRadius={52}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {categoryData.map((entry) => (
                            <Cell
                              key={entry.name}
                              fill={DONUT_COLORS[entry.name] || '#6B1D2F'}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name) => [
                            `${Number(value ?? 0)} sewa`,
                            String(name ?? ''),
                          ]}
                          contentStyle={{
                            borderRadius: '12px',
                            border: '1px solid rgba(107,29,47,0.18)',
                            fontSize: '12px',
                          }}
                        />
                        <Legend
                          verticalAlign="bottom"
                          height={32}
                          iconType="circle"
                          wrapperStyle={{ fontSize: '11px' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </section>

            {/* Orders Table */}
            {renderOrdersTable(false)}
          </>
        )}

        {activeMenu === 'orders' && renderOrdersTable(false)}

        {activeMenu === 'kebayas' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Left Column: Add/Edit Kebaya Form + Default Benefit & Ketentuan Sewa Settings */}
            <div className="xl:col-span-5 space-y-6">
              <form
                onSubmit={handleKebayaSubmit}
                className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4"
              >
              <div className="flex items-center justify-between gap-2 border-b border-[#6B1D2F]/10 pb-3">
                <div className="flex items-center gap-2">
                  <PlusCircle
                    className="w-5 h-5 text-[#6B1D2F]"
                    aria-hidden="true"
                  />
                  <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                    {editingKebayaId !== null
                      ? 'Edit Koleksi Kebaya'
                      : 'Tambah Koleksi Kebaya Baru'}
                  </h2>
                </div>
                {editingKebayaId !== null && (
                  <button
                    type="button"
                    onClick={resetKebayaForm}
                    className="text-xs font-semibold text-[#6B1D2F] underline"
                  >
                    Batal Edit
                  </button>
                )}
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label
                    htmlFor="kebaya-name"
                    className="block font-semibold text-[#2A0912]"
                  >
                    Nama Kebaya
                  </label>
                  <input
                    id="kebaya-name"
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Contoh: Kebaya Kutubaru Brokat Rose Gold"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="kebaya-category"
                      className="block font-semibold text-[#2A0912]"
                    >
                      Kategori
                    </label>
                    <select
                      id="kebaya-category"
                      value={newCategory}
                      onChange={(e) => {
                        const cat = e.target.value;
                        setNewCategory(cat);
                        if (
                          !uploadedFileName &&
                          Object.values(LOCAL_KEBAYA_IMAGES).includes(
                            newImageUrl
                          )
                        ) {
                          setNewImageUrl(
                            LOCAL_KEBAYA_IMAGES[cat] ||
                              LOCAL_KEBAYA_IMAGES.Wisuda
                          );
                        }
                      }}
                      className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                    >
                      {CATEGORY_OPTIONS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="kebaya-size"
                      className="block font-semibold text-[#2A0912]"
                    >
                      Ukuran
                    </label>
                    <input
                      id="kebaya-size"
                      type="text"
                      required
                      value={newSize}
                      onChange={(e) => setNewSize(e.target.value)}
                      placeholder="S / M / L"
                      className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label
                      htmlFor="kebaya-price"
                      className="block font-semibold text-[#2A0912]"
                    >
                      Harga / 3 Hari
                    </label>
                    <input
                      id="kebaya-price"
                      type="number"
                      min={50000}
                      step={5000}
                      required
                      value={newPrice}
                      onChange={(e) => setNewPrice(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="kebaya-stock"
                      className="block font-semibold text-[#2A0912]"
                    >
                      Stok (Set)
                    </label>
                    <input
                      id="kebaya-stock"
                      type="number"
                      min={0}
                      required
                      value={newStock}
                      onChange={(e) => setNewStock(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label
                      htmlFor="kebaya-rating"
                      className="block font-semibold text-[#2A0912]"
                    >
                      Rating Awal
                    </label>
                    <input
                      id="kebaya-rating"
                      type="number"
                      min={1}
                      max={5}
                      step={0.1}
                      required
                      value={newRating}
                      onChange={(e) => setNewRating(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                    />
                  </div>
                </div>

                {/* Upload Foto Manual + URL */}
                <div className="space-y-2 pt-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Foto Kebaya (Upload Manual atau URL)
                  </label>

                  <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-[#6B1D2F]/25 rounded-xl p-3.5 cursor-pointer bg-[#FDFBFA] hover:bg-[#F9E4E8]/40 transition-colors">
                    <Upload className="w-5 h-5 text-[#6B1D2F]" aria-hidden="true" />
                    <span className="text-xs font-semibold text-[#6B1D2F] text-center">
                      {uploadedFileName
                        ? `Foto terpilih: ${uploadedFileName}`
                        : 'Upload Foto Manual dari Perangkat'}
                    </span>
                    <span className="text-[11px] text-[#2A0912]/55">
                      Klik untuk memilih file JPG / PNG / WEBP
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleKebayaPhotoUpload}
                      className="sr-only"
                    />
                  </label>

                  {/* Live Preview */}
                  {newImageUrl && (
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-[#F9E4E8]/35 border border-[#6B1D2F]/12">
                      <KebayaImage
                        src={newImageUrl}
                        alt="Pratinjau foto kebaya"
                        category={newCategory}
                        className="w-14 h-18 rounded-lg object-cover shrink-0 bg-white"
                      />
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-[11px] font-semibold text-[#6B1D2F]">
                          Pratinjau Foto Aktif
                        </p>
                        <p className="text-[11px] text-[#2A0912]/65 truncate">
                          {uploadedFileName || newImageUrl}
                        </p>
                      </div>
                    </div>
                  )}

                  <input
                    id="kebaya-image-url"
                    type="text"
                    value={newImageUrl.startsWith('data:') ? '' : newImageUrl}
                    onChange={(e) => {
                      setUploadedFileName('');
                      setNewImageUrl(e.target.value);
                    }}
                    placeholder="Atau tempel URL gambar (https://...)"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="kebaya-desc"
                    className="block font-semibold text-[#2A0912]"
                  >
                    Deskripsi Bahan &amp; Detail
                  </label>
                  <textarea
                    id="kebaya-desc"
                    rows={3}
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Jelaskan detail brokat, payet, jarik, dan kesesuaian acara..."
                    className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="kebaya-benefits"
                    className="flex items-center gap-1.5 font-semibold text-[#2A0912]"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-[#6B1D2F]" />
                    <span>Benefit Penyewaan (1 poin per baris)</span>
                  </label>
                  <textarea
                    id="kebaya-benefits"
                    rows={3}
                    value={newBenefits}
                    onChange={(e) => setNewBenefits(e.target.value)}
                    placeholder="Contoh:&#10;Sudah Laundry Uap & Wangi Butik&#10;Free Selendang / Aksesoris Serasi"
                    className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] leading-relaxed focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="kebaya-terms"
                    className="flex items-center gap-1.5 font-semibold text-[#2A0912]"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#6B1D2F]" />
                    <span>Informasi Ketentuan Sewa (1 poin per baris)</span>
                  </label>
                  <textarea
                    id="kebaya-terms"
                    rows={3}
                    value={newTerms}
                    onChange={(e) => setNewTerms(e.target.value)}
                    placeholder="Masukkan ketentuan durasi, deposit jaminan, dan perawatan kebaya..."
                    className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] leading-relaxed focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
              </div>

              {kebayaFormMsg && (
                <div
                  className={`p-3 rounded-xl text-xs font-medium flex items-center gap-2 ${
                    kebayaFormMsg.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{kebayaFormMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={addingKebaya}
                className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white font-semibold text-sm hover:bg-[#4A1220] disabled:opacity-60 transition-colors"
              >
                {addingKebaya
                  ? 'Menyimpan...'
                  : editingKebayaId !== null
                    ? 'Simpan Perubahan Kebaya'
                    : 'Simpan ke Katalog Supabase'}
              </button>
            </form>

            {/* Default Global Benefit & Ketentuan Sewa inside Manajemen Kebaya */}
            <form
              onSubmit={handleSaveDefaultPolicies}
              className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4"
            >
              <div className="border-b border-[#6B1D2F]/10 pb-3 space-y-0.5">
                <h3 className="font-display text-lg font-bold text-[#6B1D2F]">
                  Pengaturan Default Benefit &amp; Ketentuan Sewa
                </h3>
                <p className="text-xs text-[#2A0912]/65">
                  Berlaku sebagai standar bagi kebaya yang belum memiliki pengaturan benefit/ketentuan khusus.
                </p>
              </div>

              <div className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label
                    htmlFor="default-rental-benefits"
                    className="block font-semibold text-[#2A0912]"
                  >
                    Default Benefit Penyewaan
                  </label>
                  <textarea
                    id="default-rental-benefits"
                    rows={4}
                    value={defaultBenefitsDraft}
                    onChange={(e) => {
                      setDefaultBenefitsDraft(e.target.value);
                      if (policySavedMsg) setPolicySavedMsg(null);
                    }}
                    className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] leading-relaxed focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="default-rental-terms"
                    className="block font-semibold text-[#2A0912]"
                  >
                    Default Informasi Ketentuan Sewa
                  </label>
                  <textarea
                    id="default-rental-terms"
                    rows={4}
                    value={defaultTermsDraft}
                    onChange={(e) => {
                      setDefaultTermsDraft(e.target.value);
                      if (policySavedMsg) setPolicySavedMsg(null);
                    }}
                    className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] leading-relaxed focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
              </div>

              {policySavedMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{policySavedMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full h-10 rounded-xl bg-[#D4AF37] text-[#2A0912] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#C39E2B] transition-colors"
              >
                <Save className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Simpan Pengaturan Benefit &amp; Ketentuan</span>
              </button>
            </form>
            </div>

            {/* Inventory Table & Cards */}
            <div className="xl:col-span-7 bg-white rounded-2xl border border-[#6B1D2F]/12 overflow-hidden">
              <div className="p-5 border-b border-[#6B1D2F]/10 flex items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                    Daftar Koleksi Kebaya ({kebayas.length})
                  </h2>
                  <p className="text-xs text-[#2A0912]/65 mt-0.5">
                    Kurangi stok, edit detail, atau hapus koleksi kebaya secara langsung.
                  </p>
                </div>
              </div>

              {inventoryMsg && (
                <div className="px-5 py-2.5 bg-[#F9E4E8]/60 border-b border-[#6B1D2F]/10 text-xs font-medium text-[#6B1D2F] flex items-center justify-between">
                  <span>{inventoryMsg}</span>
                  <button
                    type="button"
                    onClick={() => setInventoryMsg(null)}
                    aria-label="Tutup pesan"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Mobile Kebaya Cards */}
              <div className="md:hidden divide-y divide-[#6B1D2F]/10">
                {kebayas.map((item) => (
                  <div key={item.id} className="p-4 space-y-3">
                    <div className="flex items-center gap-3.5">
                      <KebayaImage
                        src={item.image_url}
                        alt={item.name}
                        category={item.category}
                        className="w-14 h-18 rounded-xl object-cover shrink-0"
                      />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-[#6B1D2F]/75">
                          <span>
                            {item.category} · {item.size}
                          </span>
                          <span className="font-mono font-semibold text-[#9B7B16] tabular-nums">
                            ★ {Number(item.rating || 4.8).toFixed(1)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-[#2A0912] line-clamp-1">
                          {item.name}
                        </h3>
                        <p className="text-xs font-bold text-[#6B1D2F] tabular-nums">
                          {formatIDR(item.price_per_3days)} / 3 hr
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#6B1D2F]/8">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(item, -1)}
                          disabled={item.stock <= 0}
                          className="w-8 h-8 rounded-lg border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center disabled:opacity-40"
                          aria-label={`Kurangi stok ${item.name}`}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs font-semibold px-1.5 tabular-nums">
                          Stok {item.stock}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAdjustStock(item, 1)}
                          className="w-8 h-8 rounded-lg border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center"
                          aria-label={`Tambah stok ${item.name}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingKebayaId(item.id);
                            setNewName(item.name);
                            setNewCategory(item.category);
                            setNewSize(item.size);
                            setNewPrice(String(item.price_per_3days));
                            setNewStock(String(item.stock));
                            setNewRating(String(item.rating));
                            setNewImageUrl(item.image_url);
                            setUploadedFileName('');
                            setNewDescription(item.description);
                            setNewBenefits(
                              item.rental_benefits ||
                                siteSettings.kebayaOverrides[String(item.id)]
                                  ?.rentalBenefits ||
                                siteSettings.kebayaPolicies.rentalBenefits
                            );
                            setNewTerms(
                              item.rental_terms ||
                                siteSettings.kebayaOverrides[String(item.id)]
                                  ?.rentalTerms ||
                                siteSettings.kebayaPolicies.rentalTerms
                            );
                            setKebayaFormMsg(null);
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop & Tablet Inventory Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#6B1D2F]/10 bg-[#FDFBFA] text-[11px] font-semibold text-[#6B1D2F]/80">
                      <th className="py-3 px-4">Koleksi</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4">Ukuran</th>
                      <th className="py-3 px-4 text-right">Harga / 3 Hr</th>
                      <th className="py-3 px-4 text-center">Stok</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#6B1D2F]/8 text-xs">
                    {kebayas.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-[#F9E4E8]/25 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <KebayaImage
                              src={item.image_url}
                              alt={item.name}
                              category={item.category}
                              className="w-10 h-13 rounded-lg object-cover shrink-0"
                            />
                            <div>
                              <span className="font-semibold text-[#2A0912] line-clamp-2 max-w-[180px] block">
                                {item.name}
                              </span>
                              <span className="text-[11px] font-mono text-[#9B7B16] tabular-nums">
                                ★ {Number(item.rating || 4.8).toFixed(1)}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[#6B1D2F] font-medium whitespace-nowrap">
                          {item.category}
                        </td>
                        <td className="py-3 px-4 text-[#2A0912]/80 whitespace-nowrap">
                          {item.size}
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-[#6B1D2F] tabular-nums whitespace-nowrap">
                          {formatIDR(item.price_per_3days)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(item, -1)}
                              disabled={item.stock <= 0}
                              className="w-7 h-7 rounded-md border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center hover:bg-[#F9E4E8] disabled:opacity-40"
                              aria-label={`Kurangi stok ${item.name}`}
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-7 text-center font-mono font-semibold text-[#2A0912] tabular-nums">
                              {item.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAdjustStock(item, 1)}
                              className="w-7 h-7 rounded-md border border-[#6B1D2F]/20 text-[#6B1D2F] flex items-center justify-center hover:bg-[#F9E4E8]"
                              aria-label={`Tambah stok ${item.name}`}
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingKebayaId(item.id);
                                setNewName(item.name);
                                setNewCategory(item.category);
                                setNewSize(item.size);
                                setNewPrice(String(item.price_per_3days));
                                setNewStock(String(item.stock));
                                setNewRating(String(item.rating));
                                setNewImageUrl(item.image_url);
                                setUploadedFileName('');
                                setNewDescription(item.description);
                                setNewBenefits(
                                  item.rental_benefits ||
                                    siteSettings.kebayaOverrides[String(item.id)]
                                      ?.rentalBenefits ||
                                    siteSettings.kebayaPolicies.rentalBenefits
                                );
                                setNewTerms(
                                  item.rental_terms ||
                                    siteSettings.kebayaOverrides[String(item.id)]
                                      ?.rentalTerms ||
                                    siteSettings.kebayaPolicies.rentalTerms
                                );
                                setKebayaFormMsg(null);
                              }}
                              className="p-2 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] hover:bg-[#F3D2D8]"
                              aria-label={`Edit ${item.name}`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(item)}
                              className="p-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                              aria-label={`Hapus ${item.name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeMenu === 'content' && (
          <AdminContentSettings
            settings={siteSettings}
            pickupLocations={pickupLocations}
            onSaveSettings={onSaveSettings}
            onAddPickupLocation={onAddPickupLocation}
            onUpdatePickupLocation={onUpdatePickupLocation}
            onDeletePickupLocation={onDeletePickupLocation}
            onTogglePickupActive={onTogglePickupActive}
          />
        )}
      </main>

      {/* Payment Proof Modal */}
      {proofModalUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setProofModalUrl(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-4 space-y-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#6B1D2F]/10 pb-2.5">
              <div>
                <h3 className="text-sm font-bold text-[#6B1D2F]">
                  Bukti Transfer Pembayaran
                </h3>
                <p className="font-mono text-xs text-[#2A0912]/65">
                  {proofModalCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setProofModalUrl(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B1D2F] hover:bg-[#F9E4E8]"
                aria-label="Tutup pratinjau"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden bg-[#FDFBFA] border border-[#6B1D2F]/10 flex items-center justify-center max-h-[65vh]">
              <img
                src={proofModalUrl}
                alt={`Bukti transfer ${proofModalCode}`}
                className="max-h-[65vh] w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
      {/* Delete Kebaya Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !deletingKebaya && setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-xl font-bold text-[#6B1D2F]">
                Konfirmasi Hapus Kebaya
              </h3>
              <p className="text-xs text-[#2A0912]/75 leading-relaxed">
                Apakah Anda yakin ingin menghapus koleksi{' '}
                <strong className="text-[#2A0912]">{deleteTarget.name}</strong>{' '}
                dari katalog? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={deletingKebaya}
                onClick={() => setDeleteTarget(null)}
                className="h-10 px-4 rounded-xl border border-[#6B1D2F]/20 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9E4E8]/50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingKebaya}
                onClick={handleConfirmDeleteKebaya}
                className="h-10 px-4 rounded-xl bg-red-700 text-white text-xs font-semibold hover:bg-red-800 disabled:opacity-60"
              >
                {deletingKebaya ? 'Menghapus...' : 'Ya, Hapus Kebaya'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Pesanan Modal */}
      {editBookingTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => !savingEditBooking && setEditBookingTarget(null)}
        >
          <form
            onSubmit={handleEditBookingSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4 shadow-xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[#6B1D2F]/10 pb-3">
              <div>
                <h3 className="font-display text-xl font-bold text-[#6B1D2F]">
                  Edit Pesanan
                </h3>
                <p className="font-mono text-xs text-[#2A0912]/70 mt-0.5">
                  {editBookingTarget.booking_code} ·{' '}
                  {editBookingTarget.kebaya?.name ||
                    `Kebaya #${editBookingTarget.kebaya_id}`}
                </p>
              </div>
              <button
                type="button"
                disabled={savingEditBooking}
                onClick={() => setEditBookingTarget(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[#6B1D2F] hover:bg-[#F9E4E8]"
                aria-label="Tutup modal edit pesanan"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-status"
                  className="block font-semibold text-[#2A0912]"
                >
                  Status Pesanan
                </label>
                <select
                  id="edit-booking-status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                >
                  {BOOKING_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-pickup"
                  className="block font-semibold text-[#2A0912]"
                >
                  Cabang Pengambilan
                </label>
                <select
                  id="edit-booking-pickup"
                  value={editPickupId}
                  onChange={(e) => setEditPickupId(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                >
                  <option value="">Butik Tiyara Attire (Umum)</option>
                  {pickupLocations.map((loc) => (
                    <option key={loc.id} value={String(loc.id)}>
                      {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-name"
                  className="block font-semibold text-[#2A0912]"
                >
                  Nama Penyewa
                </label>
                <input
                  id="edit-booking-name"
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-phone"
                  className="block font-semibold text-[#2A0912]"
                >
                  Nomor Telepon / WhatsApp
                </label>
                <input
                  id="edit-booking-phone"
                  type="tel"
                  required
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label
                  htmlFor="edit-booking-address"
                  className="block font-semibold text-[#2A0912]"
                >
                  Alamat Lengkap Penyewa
                </label>
                <textarea
                  id="edit-booking-address"
                  rows={2}
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-start"
                  className="block font-semibold text-[#2A0912]"
                >
                  Tanggal Mulai Sewa
                </label>
                <input
                  id="edit-booking-start"
                  type="date"
                  required
                  value={editStartDate}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setEditStartDate(nextStart);
                    const dur = Math.max(1, Number(editDurationDays) || 3);
                    if (nextStart) {
                      setEditEndDate(addDaysToISO(nextStart, dur));
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-end"
                  className="block font-semibold text-[#2A0912]"
                >
                  Tanggal Selesai Sewa
                </label>
                <input
                  id="edit-booking-end"
                  type="date"
                  required
                  value={editEndDate}
                  onChange={(e) => setEditEndDate(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-duration"
                  className="block font-semibold text-[#2A0912]"
                >
                  Durasi (Hari)
                </label>
                <input
                  id="edit-booking-duration"
                  type="number"
                  min={1}
                  required
                  value={editDurationDays}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditDurationDays(val);
                    const dur = Math.max(1, Number(val) || 3);
                    if (editStartDate) {
                      setEditEndDate(addDaysToISO(editStartDate, dur));
                    }
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-subtotal"
                  className="block font-semibold text-[#2A0912]"
                >
                  Subtotal Sewa (Rp)
                </label>
                <input
                  id="edit-booking-subtotal"
                  type="number"
                  min={0}
                  required
                  value={editSubtotal}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditSubtotal(val);
                    setEditGrandTotal(
                      String(
                        (Number(val) || 0) + (Number(editDeposit) || 0)
                      )
                    );
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-deposit"
                  className="block font-semibold text-[#2A0912]"
                >
                  Deposit Keamanan (Rp)
                </label>
                <input
                  id="edit-booking-deposit"
                  type="number"
                  min={0}
                  required
                  value={editDeposit}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditDeposit(val);
                    setEditGrandTotal(
                      String(
                        (Number(editSubtotal) || 0) + (Number(val) || 0)
                      )
                    );
                  }}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="edit-booking-grandtotal"
                  className="block font-semibold text-[#6B1D2F]"
                >
                  Grand Total (Rp)
                </label>
                <input
                  id="edit-booking-grandtotal"
                  type="number"
                  min={0}
                  required
                  value={editGrandTotal}
                  onChange={(e) => setEditGrandTotal(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#F9E4E8]/35 border border-[#6B1D2F]/25 font-bold text-xs text-[#6B1D2F] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>
            </div>

            {editBookingError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 font-medium">
                {editBookingError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#6B1D2F]/10">
              <button
                type="button"
                disabled={savingEditBooking}
                onClick={() => setEditBookingTarget(null)}
                className="h-10 px-4 rounded-xl border border-[#6B1D2F]/20 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9E4E8]/50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingEditBooking}
                className="h-10 px-5 rounded-xl bg-[#6B1D2F] text-white text-xs font-semibold hover:bg-[#4A1220] disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>
                  {savingEditBooking ? 'Menyimpan...' : 'Simpan Perubahan'}
                </span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Pesanan Confirmation Modal */}
      {deleteBookingTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => !deletingBooking && setDeleteBookingTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5">
              <h3 className="font-display text-xl font-bold text-[#6B1D2F]">
                Konfirmasi Hapus Pesanan
              </h3>
              <p className="text-xs text-[#2A0912]/75 leading-relaxed">
                Apakah Anda yakin ingin menghapus pesanan{' '}
                <strong className="font-mono text-[#6B1D2F]">
                  {deleteBookingTarget.booking_code}
                </strong>{' '}
                atas nama{' '}
                <strong className="text-[#2A0912]">
                  {deleteBookingTarget.customer_name}
                </strong>
                ? Data transaksi akan dihapus permanen dari database.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={deletingBooking}
                onClick={() => setDeleteBookingTarget(null)}
                className="h-10 px-4 rounded-xl border border-[#6B1D2F]/20 text-xs font-semibold text-[#6B1D2F] hover:bg-[#F9E4E8]/50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={deletingBooking}
                onClick={handleConfirmDeleteBooking}
                className="h-10 px-4 rounded-xl bg-red-700 text-white text-xs font-semibold hover:bg-red-800 disabled:opacity-60"
              >
                {deletingBooking ? 'Menghapus...' : 'Ya, Hapus Pesanan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
