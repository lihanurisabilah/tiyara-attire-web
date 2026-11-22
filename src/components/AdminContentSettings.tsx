import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Crown,
  Edit3,
  Gift,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  MapPin,
  Phone,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { PickupLocation } from '../types/database';
import {
  CategoryIconKey,
  PromoItemConfig,
  SiteContentSettings,
} from '../types/settings';
import { BrandLogo } from './BrandLogo';

interface AdminContentSettingsProps {
  settings: SiteContentSettings;
  pickupLocations: PickupLocation[];
  onSaveSettings: (next: SiteContentSettings) => void;
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

type ContentSubTab = 'browse' | 'logo' | 'booking' | 'promo' | 'contact';

const MAX_RAW_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_SVG_BYTES = 300 * 1024; // 300 KB

function processLogoImageFile(
  file: File
): Promise<{ dataUrl: string; width?: number; height?: number }> {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) {
      reject(
        new Error(
          'Format file tidak valid. Harap pilih file gambar (PNG, JPG, WebP, atau SVG).'
        )
      );
      return;
    }

    if (file.size > MAX_RAW_LOGO_BYTES) {
      reject(new Error('Ukuran file logo terlalu besar. Maksimal 5 MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error('Gagal membaca file gambar dari perangkat.'));

    reader.onload = () => {
      const rawResult = String(reader.result || '');

      if (file.type === 'image/svg+xml') {
        if (file.size > MAX_SVG_BYTES) {
          reject(
            new Error(
              'Ukuran file SVG maksimal 300 KB agar tetap ringan dimuat.'
            )
          );
          return;
        }
        resolve({ dataUrl: rawResult });
        return;
      }

      const img = new Image();
      img.onerror = () =>
        reject(
          new Error(
            'File gambar tidak dapat diproses. Pastikan gambar tidak rusak.'
          )
        );
      img.onload = () => {
        const maxWidth = 480;
        const maxHeight = 240;
        const widthRatio = img.width > maxWidth ? maxWidth / img.width : 1;
        const heightRatio = img.height > maxHeight ? maxHeight / img.height : 1;
        const scale = Math.min(widthRatio, heightRatio, 1);

        const targetW = Math.max(1, Math.round(img.width * scale));
        const targetH = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve({ dataUrl: rawResult, width: img.width, height: img.height });
          return;
        }
        ctx.clearRect(0, 0, targetW, targetH);
        ctx.drawImage(img, 0, 0, targetW, targetH);

        // Preserve transparency with PNG first; compress to WebP if too large
        let outUrl = canvas.toDataURL('image/png');
        if (outUrl.length > 350000) {
          const webpUrl = canvas.toDataURL('image/webp', 0.88);
          if (webpUrl.startsWith('data:image/webp') && webpUrl.length < outUrl.length) {
            outUrl = webpUrl;
          } else {
            outUrl = canvas.toDataURL('image/jpeg', 0.86);
          }
        }

        resolve({ dataUrl: outUrl, width: targetW, height: targetH });
      };
      img.src = rawResult;
    };

    reader.readAsDataURL(file);
  });
}

const ICON_OPTIONS: { value: CategoryIconKey; label: string }[] = [
  { value: 'sparkles', label: 'Kilau (Semua)' },
  { value: 'graduation', label: 'Toga (Wisuda)' },
  { value: 'heart', label: 'Hati (Lamaran)' },
  { value: 'crown', label: 'Mahkota (Akad Nikah)' },
  { value: 'gem', label: 'Permata (Kondangan)' },
];

export const AdminContentSettings: React.FC<AdminContentSettingsProps> = ({
  settings,
  pickupLocations,
  onSaveSettings,
  onAddPickupLocation,
  onUpdatePickupLocation,
  onDeletePickupLocation,
  onTogglePickupActive,
}) => {
  const [subTab, setSubTab] = useState<ContentSubTab>('browse');
  const [draft, setDraft] = useState<SiteContentSettings>(settings);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // New Category form state
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatIcon, setNewCatIcon] = useState<CategoryIconKey>('gem');

  // Promo form state (Add / Edit)
  const [editingPromoId, setEditingPromoId] = useState<string | null>(null);
  const [promoTitle, setPromoTitle] = useState('');
  const [promoDesc, setPromoDesc] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoPeriod, setPromoPeriod] = useState('');
  const [promoTargetCat, setPromoTargetCat] = useState('Semua');
  const [promoHighlight, setPromoHighlight] = useState(false);

  // Pickup location CRUD state
  const [editingPickupId, setEditingPickupId] = useState<
    string | number | null
  >(null);
  const [pickupName, setPickupName] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [savingPickup, setSavingPickup] = useState(false);
  const [pickupMsg, setPickupMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [confirmDeletePickupId, setConfirmDeletePickupId] = useState<
    string | number | null
  >(null);

  // Logo management state
  const [logoDraftUrl, setLogoDraftUrl] = useState<string>(
    settings.brand?.logoUrl || ''
  );
  const [logoFileName, setLogoFileName] = useState<string>('');
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoPreviewBroken, setLogoPreviewBroken] = useState<boolean>(false);

  useEffect(() => {
    setDraft(settings);
    setLogoDraftUrl(settings.brand?.logoUrl || '');
    setLogoPreviewBroken(false);
  }, [settings]);

  const commitSave = (nextSettings: SiteContentSettings, msg?: string) => {
    setDraft(nextSettings);
    onSaveSettings(nextSettings);
    setSaveMessage(
      msg ||
        'Pengaturan tampilan & konten berhasil disimpan dan langsung aktif di halaman Customer.'
    );
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const handleBrowseSave = (e: React.FormEvent) => {
    e.preventDefault();
    commitSave(draft, 'Pengaturan halaman Browse berhasil disimpan.');
  };

  const handleAddCategory = () => {
    const label = newCatLabel.trim();
    if (!label) return;
    if (
      draft.browse.categories.some(
        (c) => c.label.toLowerCase() === label.toLowerCase()
      )
    ) {
      return;
    }
    const next: SiteContentSettings = {
      ...draft,
      browse: {
        ...draft.browse,
        categories: [
          ...draft.browse.categories,
          { id: label, label, iconKey: newCatIcon },
        ],
      },
    };
    setNewCatLabel('');
    commitSave(next, `Kategori "${label}" ditambahkan.`);
  };

  const handleUpdateCategory = (
    index: number,
    patch: Partial<{ label: string; iconKey: CategoryIconKey }>
  ) => {
    const updated = draft.browse.categories.map((cat, idx) => {
      if (idx !== index) return cat;
      const nextLabel = patch.label !== undefined ? patch.label : cat.label;
      return {
        ...cat,
        ...patch,
        id: cat.id === 'Semua' ? 'Semua' : nextLabel || cat.id,
      };
    });
    setDraft({
      ...draft,
      browse: { ...draft.browse, categories: updated },
    });
  };

  const handleDeleteCategory = (index: number) => {
    const target = draft.browse.categories[index];
    if (!target || target.id === 'Semua') return;
    const next: SiteContentSettings = {
      ...draft,
      browse: {
        ...draft.browse,
        categories: draft.browse.categories.filter((_, idx) => idx !== index),
      },
    };
    commitSave(next, `Kategori "${target.label}" dihapus.`);
  };

  const resetPromoForm = () => {
    setEditingPromoId(null);
    setPromoTitle('');
    setPromoDesc('');
    setPromoCode('');
    setPromoPeriod('');
    setPromoTargetCat('Semua');
    setPromoHighlight(false);
  };

  const handleSavePromo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promoTitle.trim() || !promoDesc.trim()) return;

    if (editingPromoId) {
      const updatedPromos = draft.promos.map((p) =>
        p.id === editingPromoId
          ? {
              ...p,
              title: promoTitle.trim(),
              description: promoDesc.trim(),
              codeOrTerms: promoCode.trim() || 'TIYARA-PROMO',
              validPeriod: promoPeriod.trim() || 'Berlaku saat ini',
              targetCategory: promoTargetCat,
              highlight: promoHighlight,
            }
          : p
      );
      commitSave(
        { ...draft, promos: updatedPromos },
        'Promo berhasil diperbarui.'
      );
      resetPromoForm();
      return;
    }

    const newPromo: PromoItemConfig = {
      id: `promo-${Date.now()}`,
      title: promoTitle.trim(),
      description: promoDesc.trim(),
      codeOrTerms: promoCode.trim() || 'TIYARA-PROMO',
      validPeriod: promoPeriod.trim() || 'Berlaku saat ini',
      targetCategory: promoTargetCat,
      active: true,
      highlight: promoHighlight,
    };
    commitSave(
      { ...draft, promos: [newPromo, ...draft.promos] },
      'Promo baru berhasil ditambahkan.'
    );
    resetPromoForm();
  };

  const handleTogglePromoActive = (id: string) => {
    const updated = draft.promos.map((p) =>
      p.id === id ? { ...p, active: !p.active } : p
    );
    commitSave({ ...draft, promos: updated }, 'Status promo diperbarui.');
  };

  const handleDeletePromo = (id: string) => {
    const updated = draft.promos.filter((p) => p.id !== id);
    commitSave({ ...draft, promos: updated }, 'Promo dihapus.');
  };

  const handleContactSave = (e: React.FormEvent) => {
    e.preventDefault();
    commitSave(draft, 'Informasi kontak butik berhasil disimpan.');
  };

  const handleBookingFormSave = (e: React.FormEvent) => {
    e.preventDefault();
    commitSave(
      draft,
      'Pengaturan tampilan Form Reservasi Sewa berhasil disimpan.'
    );
  };

  const resetPickupForm = () => {
    setEditingPickupId(null);
    setPickupName('');
    setPickupAddress('');
  };

  const handlePickupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPickupMsg(null);
    if (pickupName.trim().length < 2 || pickupAddress.trim().length < 5) {
      setPickupMsg({
        type: 'error',
        text: 'Nama cabang dan alamat lengkap pengambilan wajib diisi.',
      });
      return;
    }

    setSavingPickup(true);
    if (editingPickupId !== null) {
      const res = await onUpdatePickupLocation(editingPickupId, {
        name: pickupName.trim(),
        address: pickupAddress.trim(),
      });
      setSavingPickup(false);
      if (res.success) {
        setPickupMsg({
          type: 'success',
          text: `Cabang "${pickupName.trim()}" berhasil diperbarui.`,
        });
        resetPickupForm();
      } else {
        setPickupMsg({
          type: 'error',
          text: res.error || 'Gagal memperbarui cabang pengambilan.',
        });
      }
      return;
    }

    const res = await onAddPickupLocation({
      name: pickupName.trim(),
      address: pickupAddress.trim(),
    });
    setSavingPickup(false);
    if (res.success) {
      setPickupMsg({
        type: 'success',
        text: `Cabang "${pickupName.trim()}" berhasil ditambahkan ke Supabase.`,
      });
      resetPickupForm();
    } else {
      setPickupMsg({
        type: 'error',
        text: res.error || 'Gagal menambahkan cabang pengambilan.',
      });
    }
  };

  const handleConfirmDeletePickup = async (id: string | number) => {
    setPickupMsg(null);
    const res = await onDeletePickupLocation(id);
    setConfirmDeletePickupId(null);
    if (res.success) {
      setPickupMsg({
        type: 'success',
        text: 'Cabang pengambilan berhasil dihapus.',
      });
      if (String(editingPickupId) === String(id)) {
        resetPickupForm();
      }
    } else {
      setPickupMsg({
        type: 'error',
        text: res.error || 'Gagal menghapus cabang pengambilan.',
      });
    }
  };

  const handleLogoFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setLogoError(null);
    setLogoPreviewBroken(false);
    try {
      const processed = await processLogoImageFile(file);
      setLogoDraftUrl(processed.dataUrl);
      setLogoFileName(file.name);
    } catch (err) {
      setLogoError(
        err instanceof Error
          ? err.message
          : 'Gagal memproses file logo dari perangkat.'
      );
    }
  };

  const handleSaveLogo = (e: React.FormEvent) => {
    e.preventDefault();
    setLogoError(null);
    const cleaned = logoDraftUrl.trim();

    if (
      cleaned &&
      !/^(https?:\/\/|data:image\/|\/)/i.test(cleaned)
    ) {
      setLogoError(
        'URL logo harus diawali http://, https://, atau path gambar yang valid.'
      );
      return;
    }

    if (cleaned && logoPreviewBroken) {
      setLogoError(
        'Gambar logo dari URL tersebut gagal dimuat. Periksa kembali tautan gambar Anda.'
      );
      return;
    }

    const nextSettings: SiteContentSettings = {
      ...draft,
      brand: {
        ...draft.brand,
        logoUrl: cleaned,
      },
    };
    commitSave(
      nextSettings,
      cleaned
        ? 'Logo Tiyara Attire berhasil disimpan dan diterapkan ke halaman Customer.'
        : 'Logo Teks Bawaan Tiyara Attire aktif kembali.'
    );
  };

  const handleClearCustomLogo = () => {
    setLogoError(null);
    setLogoPreviewBroken(false);
    setLogoDraftUrl('');
    setLogoFileName('');
    const nextSettings: SiteContentSettings = {
      ...draft,
      brand: {
        ...draft.brand,
        logoUrl: '',
      },
    };
    commitSave(
      nextSettings,
      'Logo kustom dihapus. Halaman Customer kini menggunakan Logo Teks Bawaan Tiyara Attire.'
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-Tabs */}
      <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-3 sm:p-4">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'browse' as const, label: 'Menu Browse', icon: LayoutTemplate },
            {
              id: 'logo' as const,
              label: 'Logo Tiyara Attire',
              icon: Crown,
            },
            {
              id: 'booking' as const,
              label: 'Form Reservasi',
              icon: ClipboardList,
            },
            { id: 'promo' as const, label: 'Menu Promo', icon: Gift },
            { id: 'contact' as const, label: 'Menu Kontak', icon: Phone },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`h-10 px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  active
                    ? 'bg-[#6B1D2F] text-[#D4AF37]'
                    : 'bg-[#F9E4E8]/60 text-[#6B1D2F] hover:bg-[#F9E4E8]'
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {saveMessage && (
        <div
          role="status"
          className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* SUB-TAB 1: MENU BROWSE */}
      {subTab === 'browse' && (
        <form
          onSubmit={handleBrowseSave}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-6 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 border-b border-[#6B1D2F]/10 pb-2.5">
              <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                Teks Header, Pencarian &amp; Banner
              </h2>
              <button
                type="button"
                onClick={() => setSubTab('logo')}
                className="px-3 py-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] text-[11px] font-semibold inline-flex items-center gap-1.5 hover:bg-[#F3D2D8] transition-colors shrink-0"
              >
                <ImageIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Atur Logo</span>
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Judul Utama Beranda
                </label>
                <input
                  type="text"
                  required
                  value={draft.browse.heroTitle}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      browse: { ...draft.browse, heroTitle: e.target.value },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Subjudul Utama
                </label>
                <input
                  type="text"
                  required
                  value={draft.browse.heroSubtitle}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      browse: { ...draft.browse, heroSubtitle: e.target.value },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Placeholder Kolom Pencarian
                </label>
                <input
                  type="text"
                  required
                  value={draft.browse.searchPlaceholder}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      browse: {
                        ...draft.browse,
                        searchPlaceholder: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="pt-2 border-t border-[#6B1D2F]/10 space-y-3">
                <p className="font-semibold text-[#6B1D2F]">Banner Promo Utama</p>
                <div className="space-y-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Label Kecil Banner
                  </label>
                  <input
                    type="text"
                    value={draft.browse.bannerTag}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        browse: { ...draft.browse, bannerTag: e.target.value },
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Judul Banner
                  </label>
                  <input
                    type="text"
                    value={draft.browse.bannerTitle}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        browse: {
                          ...draft.browse,
                          bannerTitle: e.target.value,
                        },
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Keterangan Banner
                  </label>
                  <input
                    type="text"
                    value={draft.browse.bannerSubtitle}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        browse: {
                          ...draft.browse,
                          bannerSubtitle: e.target.value,
                        },
                      })
                    }
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] transition-colors"
            >
              <Save className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
              <span>Simpan Pengaturan Browse</span>
            </button>
          </div>

          <div className="lg:col-span-6 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4">
            <h2 className="font-display text-xl font-bold text-[#6B1D2F] border-b border-[#6B1D2F]/10 pb-2.5">
              Daftar Kategori Filter Customer
            </h2>

            <div className="space-y-2.5">
              {draft.browse.categories.map((cat, idx) => (
                <div
                  key={`${cat.id}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10"
                >
                  <input
                    type="text"
                    value={cat.label}
                    onChange={(e) =>
                      handleUpdateCategory(idx, { label: e.target.value })
                    }
                    className="flex-1 h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/15 text-xs font-semibold text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                  <select
                    value={cat.iconKey}
                    onChange={(e) =>
                      handleUpdateCategory(idx, {
                        iconKey: e.target.value as CategoryIconKey,
                      })
                    }
                    className="h-9 px-2.5 rounded-lg bg-white border border-[#6B1D2F]/15 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {cat.id !== 'Semua' && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(idx)}
                      className="h-9 px-2.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 text-xs font-semibold inline-flex items-center justify-center gap-1"
                      aria-label={`Hapus kategori ${cat.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus</span>
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[#6B1D2F]/10 space-y-2">
              <p className="text-xs font-semibold text-[#6B1D2F]">
                Tambah Kategori Baru
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={newCatLabel}
                  onChange={(e) => setNewCatLabel(e.target.value)}
                  placeholder="Nama kategori (mis. Bridesmaid)"
                  className="flex-1 h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
                <select
                  value={newCatIcon}
                  onChange={(e) =>
                    setNewCatIcon(e.target.value as CategoryIconKey)
                  }
                  className="h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912]"
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddCategory}
                  className="h-10 px-4 rounded-xl bg-[#D4AF37] text-[#2A0912] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#C39E2B] whitespace-nowrap shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB: LOGO TIYARA ATTIRE */}
      {subTab === 'logo' && (
        <form
          onSubmit={handleSaveLogo}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
        >
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-5">
            <div className="border-b border-[#6B1D2F]/10 pb-3">
              <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                Logo Tiyara Attire
              </h2>
              <p className="text-xs text-[#2A0912]/70 mt-1">
                Unggah gambar logo butik dari perangkat atau tempel URL gambar logo. Logo yang disimpan otomatis tampil di header/navbar dan identitas brand halaman Customer.
              </p>
            </div>

            {/* Option A: Manual File Upload */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#6B1D2F]">
                1. Upload File Logo Manual dari Perangkat
              </label>
              <label className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border-2 border-dashed border-[#6B1D2F]/25 bg-[#FDFBFA] hover:border-[#6B1D2F]/50 cursor-pointer transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-[#F9E4E8] text-[#6B1D2F] flex items-center justify-center shrink-0">
                    <Upload className="w-4 h-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#2A0912] truncate">
                      {logoFileName
                        ? `File terpilih: ${logoFileName}`
                        : 'Pilih file logo (PNG, JPG, WebP, SVG)'}
                    </p>
                    <p className="text-[11px] text-[#2A0912]/60">
                      Maks. 5 MB · PNG transparan disarankan agar rapi di header
                    </p>
                  </div>
                </div>
                <span className="px-3.5 py-2 rounded-lg bg-[#6B1D2F] text-white text-xs font-semibold whitespace-nowrap shrink-0 text-center">
                  Pilih File Gambar
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Option B: Direct Image URL */}
            <div className="space-y-1.5">
              <label
                htmlFor="brand-logo-url"
                className="flex items-center gap-1.5 text-xs font-semibold text-[#6B1D2F]"
              >
                <Link2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>2. Atau Masukkan URL Gambar Logo (Opsional)</span>
              </label>
              <input
                id="brand-logo-url"
                type="text"
                value={logoDraftUrl.startsWith('data:image/') ? '' : logoDraftUrl}
                onChange={(e) => {
                  setLogoDraftUrl(e.target.value);
                  setLogoFileName('');
                  setLogoError(null);
                  setLogoPreviewBroken(false);
                }}
                placeholder={
                  logoDraftUrl.startsWith('data:image/')
                    ? 'Logo aktif berasal dari unggahan perangkat (tempel URL jika ingin mengganti)'
                    : 'https://contoh.com/assets/logo-tiyara-attire.png'
                }
                className="w-full h-11 px-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs sm:text-sm text-[#2A0912] placeholder:text-[#2A0912]/40 focus:outline-none focus:border-[#6B1D2F]"
              />
              {logoDraftUrl.startsWith('data:image/') && (
                <p className="text-[11px] text-[#6B1D2F]/75">
                  Logo saat ini siap disimpan dari file gambar yang diunggah.
                </p>
              )}
            </div>

            {logoError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-800 flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{logoError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 h-11 px-4 rounded-xl bg-[#6B1D2F] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] transition-colors"
              >
                <Save className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
                <span>Simpan Logo</span>
              </button>
              <button
                type="button"
                onClick={handleClearCustomLogo}
                disabled={
                  !logoDraftUrl && !(settings.brand?.logoUrl || '').trim()
                }
                className="h-11 px-4 rounded-xl border border-[#6B1D2F]/25 bg-white text-[#6B1D2F] text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-[#F9E4E8]/60 disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Hapus / Gunakan Logo Teks Bawaan</span>
              </button>
            </div>
          </div>

          {/* Live Preview Card */}
          <div className="lg:col-span-5 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#6B1D2F]/10 pb-2.5">
              <h3 className="font-display text-lg font-bold text-[#6B1D2F]">
                Pratinjau Langsung Logo
              </h3>
              <span
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${
                  logoDraftUrl.trim()
                    ? 'bg-[#D4AF37]/20 text-[#6B1D2F]'
                    : 'bg-[#F9E4E8] text-[#6B1D2F]'
                }`}
              >
                {logoDraftUrl.trim() ? 'Logo Kustom' : 'Logo Bawaan'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#2A0912]/65">
                  Tampilan pada Navbar Halaman Customer
                </p>
                <div className="h-14 px-4 rounded-xl bg-white border border-[#6B1D2F]/15 shadow-xs flex items-center justify-between gap-3">
                  {logoDraftUrl.trim() ? (
                    <img
                      src={logoDraftUrl.trim()}
                      alt="Pratinjau Logo Tiyara Attire"
                      onLoad={() => setLogoPreviewBroken(false)}
                      onError={() => setLogoPreviewBroken(true)}
                      className="h-8 sm:h-9 w-auto max-w-[170px] object-contain"
                    />
                  ) : (
                    <BrandLogo logoUrl="" size="md" />
                  )}
                  <div className="flex items-center gap-1 p-1 rounded-lg bg-[#F9E4E8]/80 text-[10px] font-semibold text-[#6B1D2F] shrink-0">
                    <span className="px-2 py-1 rounded bg-[#6B1D2F] text-white">
                      Customer
                    </span>
                    <span className="px-2 py-1">Admin EDA</span>
                  </div>
                </div>
              </div>

              {logoPreviewBroken && logoDraftUrl.trim() && (
                <p className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                  Gambar dari tautan tersebut tidak dapat dimuat. Pastikan URL gambar bersifat publik dan valid.
                </p>
              )}

              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-[#2A0912]/65">
                  Pratinjau Ukuran &amp; Proporsi
                </p>
                <div className="p-5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/12 flex items-center justify-center min-h-[110px]">
                  <BrandLogo
                    logoUrl={logoDraftUrl}
                    brandName={draft.browse.heroTitle || 'Tiyara Attire'}
                    size="lg"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#F9E4E8]/45 border border-[#6B1D2F]/10 text-[11px] text-[#2A0912]/75 leading-relaxed">
                Perubahan pratinjau belum aktif di halaman Customer sebelum Anda menekan tombol <strong>Simpan Logo</strong>.
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUB-TAB 2: MENU PROMO */}
      {subTab === 'promo' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleSavePromo}
            className="lg:col-span-5 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-[#6B1D2F]/10 pb-2.5">
              <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                {editingPromoId ? 'Edit Promo' : 'Tambah Promo Baru'}
              </h2>
              {editingPromoId && (
                <button
                  type="button"
                  onClick={resetPromoForm}
                  className="text-xs text-[#6B1D2F] underline"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Judul Promo
                </label>
                <input
                  type="text"
                  required
                  value={promoTitle}
                  onChange={(e) => setPromoTitle(e.target.value)}
                  placeholder="Contoh: Diskon 15% Paket Wisuda Kelompok"
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Deskripsi &amp; Ketentuan
                </label>
                <textarea
                  rows={3}
                  required
                  value={promoDesc}
                  onChange={(e) => setPromoDesc(e.target.value)}
                  placeholder="Jelaskan potongan, bonus aksesori, atau syarat minimal sewa..."
                  className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Kode / Label Syarat
                  </label>
                  <input
                    type="text"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="TIYARA-PROMO"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block font-semibold text-[#2A0912]">
                    Periode Berlaku
                  </label>
                  <input
                    type="text"
                    value={promoPeriod}
                    onChange={(e) => setPromoPeriod(e.target.value)}
                    placeholder="s/d 31 Des 2026"
                    className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Kategori Tujuan Tombol
                </label>
                <select
                  value={promoTargetCat}
                  onChange={(e) => setPromoTargetCat(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912]"
                >
                  {draft.browse.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={promoHighlight}
                  onChange={(e) => setPromoHighlight(e.target.checked)}
                  className="w-4 h-4 accent-[#6B1D2F] rounded"
                />
                <span className="text-xs font-medium text-[#2A0912]">
                  Tampilkan sebagai Kartu Highlight Maroon
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full h-11 rounded-xl bg-[#6B1D2F] text-white text-sm font-semibold hover:bg-[#4A1220] transition-colors"
            >
              {editingPromoId ? 'Simpan Perubahan Promo' : 'Tambah ke Daftar Promo'}
            </button>
          </form>

          <div className="lg:col-span-7 space-y-3">
            <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
              Daftar Promo ({draft.promos.length})
            </h2>
            {draft.promos.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#6B1D2F]/12 p-8 text-center text-xs text-[#2A0912]/60">
                Belum ada promo terdaftar. Tambahkan promo pertama di samping.
              </div>
            ) : (
              draft.promos.map((promo) => (
                <div
                  key={promo.id}
                  className={`rounded-2xl border p-4 space-y-2.5 ${
                    promo.active
                      ? 'bg-white border-[#6B1D2F]/15'
                      : 'bg-neutral-50 border-neutral-200 opacity-75'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-[11px] font-semibold">
                        <span className="font-mono text-[#9B7B16]">
                          {promo.codeOrTerms}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#6B1D2F]/75">
                          {promo.validPeriod}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-[#2A0912] mt-0.5">
                        {promo.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePromoActive(promo.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                          promo.active
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {promo.active ? 'Aktif' : 'Nonaktif'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPromoId(promo.id);
                          setPromoTitle(promo.title);
                          setPromoDesc(promo.description);
                          setPromoCode(promo.codeOrTerms);
                          setPromoPeriod(promo.validPeriod);
                          setPromoTargetCat(promo.targetCategory);
                          setPromoHighlight(Boolean(promo.highlight));
                        }}
                        className="p-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] hover:bg-[#F3D2D8]"
                        aria-label={`Edit promo ${promo.title}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePromo(promo.id)}
                        className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                        aria-label={`Hapus promo ${promo.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-[#2A0912]/75 leading-relaxed">
                    {promo.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: MENU KONTAK */}
      {subTab === 'contact' && (
        <form
          onSubmit={handleContactSave}
          className="max-w-3xl bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-[#6B1D2F]/10 pb-3">
            <Globe className="w-5 h-5 text-[#6B1D2F]" aria-hidden="true" />
            <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
              Informasi Kontak &amp; Butik Tiyara Attire
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="sm:col-span-2 space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Alamat Butik Utama / Pickup
              </label>
              <textarea
                rows={2}
                required
                value={draft.contact.boutiqueAddress}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: {
                      ...draft.contact,
                      boutiqueAddress: e.target.value,
                    },
                  })
                }
                className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Nomor WhatsApp / Telepon
              </label>
              <input
                type="text"
                required
                value={draft.contact.whatsappNumber}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: {
                      ...draft.contact,
                      whatsappNumber: e.target.value,
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] tabular-nums focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Email Butik
              </label>
              <input
                type="email"
                required
                value={draft.contact.email}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: { ...draft.contact, email: e.target.value },
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Jam Operasional
              </label>
              <input
                type="text"
                required
                value={draft.contact.operationalHours}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: {
                      ...draft.contact,
                      operationalHours: e.target.value,
                    },
                  })
                }
                className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Tautan Instagram / Media Sosial
              </label>
              <input
                type="url"
                value={draft.contact.instagramUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: { ...draft.contact, instagramUrl: e.target.value },
                  })
                }
                placeholder="https://instagram.com/..."
                className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-semibold text-[#2A0912]">
                Tautan Google Maps
              </label>
              <input
                type="url"
                value={draft.contact.mapsUrl}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    contact: { ...draft.contact, mapsUrl: e.target.value },
                  })
                }
                placeholder="https://maps.google.com/..."
                className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="h-11 px-6 rounded-xl bg-[#6B1D2F] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] transition-colors"
          >
            <Save className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
            <span>Simpan Informasi Kontak</span>
          </button>
        </form>
      )}

      {/* SUB-TAB 4: FORM RESERVASI SEWA & CABANG PENGAMBILAN */}
      {subTab === 'booking' && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          <form
            onSubmit={handleBookingFormSave}
            className="xl:col-span-7 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 sm:p-6 space-y-5"
          >
            <div className="flex items-center gap-2 border-b border-[#6B1D2F]/10 pb-3">
              <ClipboardList className="w-5 h-5 text-[#6B1D2F]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                  Pengaturan Tampilan Form Reservasi Sewa &amp; Pembayaran
                </h2>
                <p className="text-xs text-[#2A0912]/65">
                  Atur judul form, catatan pengisian data penyewa, rekening/QRIS transfer, serta catatan konfirmasi pembayaran.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Judul Form Reservasi Sewa
                </label>
                <input
                  type="text"
                  required
                  value={draft.bookingForm.formTitle}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        formTitle: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-sm text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Catatan Pengambilan di Butik (Pickup Store)
                </label>
                <input
                  type="text"
                  required
                  value={draft.bookingForm.pickupNote}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        pickupNote: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="md:col-span-2 p-4 rounded-xl bg-[#F9E4E8]/45 border border-[#6B1D2F]/15 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label
                      htmlFor="setting-dp-percentage"
                      className="block font-semibold text-[#6B1D2F]"
                    >
                      Persentase Pembayaran DP (Down Payment) (%)
                    </label>
                    <p className="text-[11px] text-[#2A0912]/70 mt-0.5">
                      Pelanggan hanya membayar DP {draft.bookingForm.dpPercentage}% saat reservasi, dan sisa {100 - draft.bookingForm.dpPercentage}% dilunasi saat pengambilan di cabang.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      id="setting-dp-percentage"
                      type="number"
                      min={10}
                      max={90}
                      step={5}
                      required
                      value={draft.bookingForm.dpPercentage}
                      onChange={(e) => {
                        const val = Math.min(
                          90,
                          Math.max(10, Number(e.target.value) || 50)
                        );
                        setDraft({
                          ...draft,
                          bookingForm: {
                            ...draft.bookingForm,
                            dpPercentage: val,
                          },
                        });
                      }}
                      className="w-24 h-10 px-3 rounded-xl bg-white border border-[#6B1D2F]/25 font-mono text-sm font-bold text-[#6B1D2F] text-center tabular-nums focus:outline-none focus:border-[#6B1D2F]"
                    />
                    <span className="font-bold text-sm text-[#6B1D2F]">%</span>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Catatan / Instruksi Pengisian Data Penyewa
                </label>
                <textarea
                  rows={2}
                  required
                  value={draft.bookingForm.customerDataNote}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        customerDataNote: e.target.value,
                      },
                    })
                  }
                  className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Catatan Pengantar Transfer / Pembayaran
                </label>
                <input
                  type="text"
                  required
                  value={draft.bookingForm.bankTransferNote}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        bankTransferNote: e.target.value,
                      },
                    })
                  }
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10 space-y-2">
                <label className="block font-semibold text-[#6B1D2F]">
                  Rekening Transfer 1
                </label>
                <input
                  type="text"
                  required
                  value={draft.bookingForm.bank1Label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        bank1Label: e.target.value,
                      },
                    })
                  }
                  placeholder="Nama Bank & Pemilik Rekening"
                  className="w-full h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/20 text-xs text-[#2A0912]"
                />
                <input
                  type="text"
                  required
                  value={draft.bookingForm.bank1Number}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        bank1Number: e.target.value,
                      },
                    })
                  }
                  placeholder="Nomor Rekening"
                  className="w-full h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/20 font-mono text-xs text-[#2A0912]"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/10 space-y-2">
                <label className="block font-semibold text-[#6B1D2F]">
                  Rekening Transfer 2
                </label>
                <input
                  type="text"
                  required
                  value={draft.bookingForm.bank2Label}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        bank2Label: e.target.value,
                      },
                    })
                  }
                  placeholder="Nama Bank & Pemilik Rekening"
                  className="w-full h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/20 text-xs text-[#2A0912]"
                />
                <input
                  type="text"
                  required
                  value={draft.bookingForm.bank2Number}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        bank2Number: e.target.value,
                      },
                    })
                  }
                  placeholder="Nomor Rekening"
                  className="w-full h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/20 font-mono text-xs text-[#2A0912]"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Informasi QRIS Pembayaran
                </label>
                <input
                  type="text"
                  value={draft.bookingForm.qrisInfo}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        qrisInfo: e.target.value,
                      },
                    })
                  }
                  placeholder="Keterangan QRIS resmi butik (opsional)"
                  className="w-full h-10 px-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Catatan Konfirmasi Pembayaran
                </label>
                <textarea
                  rows={2}
                  required
                  value={draft.bookingForm.paymentConfirmationNote}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      bookingForm: {
                        ...draft.bookingForm,
                        paymentConfirmationNote: e.target.value,
                      },
                    })
                  }
                  className="w-full p-3 rounded-xl bg-[#FDFBFA] border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>
            </div>

            <button
              type="submit"
              className="h-11 px-6 rounded-xl bg-[#6B1D2F] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 hover:bg-[#4A1220] transition-colors"
            >
              <Save className="w-4 h-4 text-[#D4AF37]" aria-hidden="true" />
              <span>Simpan Pengaturan Form Reservasi</span>
            </button>
          </form>

          {/* Cabang Pengambilan (Supabase pickup_locations CRUD) */}
          <div className="xl:col-span-5 bg-white rounded-2xl border border-[#6B1D2F]/12 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 border-b border-[#6B1D2F]/10 pb-3">
              <MapPin className="w-5 h-5 text-[#6B1D2F]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-xl font-bold text-[#6B1D2F]">
                  Edit Cabang Pengambilan
                </h2>
                <p className="text-xs text-[#2A0912]/65">
                  Kelola lokasi butik pengambilan (`pickup_locations`) yang muncul di Form Reservasi Customer.
                </p>
              </div>
            </div>

            <form onSubmit={handlePickupSubmit} className="space-y-3 text-xs bg-[#FDFBFA] p-4 rounded-xl border border-[#6B1D2F]/10">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[#6B1D2F]">
                  {editingPickupId !== null
                    ? 'Edit Cabang Pengambilan'
                    : 'Tambah Cabang Baru'}
                </span>
                {editingPickupId !== null && (
                  <button
                    type="button"
                    onClick={resetPickupForm}
                    className="text-xs text-[#6B1D2F] underline"
                  >
                    Batal Edit
                  </button>
                )}
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Nama Cabang / Butik
                </label>
                <input
                  type="text"
                  required
                  value={pickupName}
                  onChange={(e) => setPickupName(e.target.value)}
                  placeholder="Contoh: Tiyara Atelier Kemang"
                  className="w-full h-9 px-3 rounded-lg bg-white border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-semibold text-[#2A0912]">
                  Alamat Lengkap &amp; Detail Cabang
                </label>
                <textarea
                  rows={2}
                  required
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  placeholder="Contoh: Jl. Kemang Raya No. 48, Jakarta Selatan (Buka 09.00–20.00)"
                  className="w-full p-2.5 rounded-lg bg-white border border-[#6B1D2F]/20 text-xs text-[#2A0912] focus:outline-none focus:border-[#6B1D2F]"
                />
              </div>
              <button
                type="submit"
                disabled={savingPickup}
                className="w-full h-9 rounded-lg bg-[#D4AF37] text-[#2A0912] text-xs font-bold inline-flex items-center justify-center gap-1.5 hover:bg-[#C39E2B] disabled:opacity-60"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>
                  {savingPickup
                    ? 'Menyimpan...'
                    : editingPickupId !== null
                      ? 'Simpan Perubahan Cabang'
                      : 'Tambah Cabang ke Supabase'}
                </span>
              </button>
            </form>

            {pickupMsg && (
              <div
                className={`p-3 rounded-xl text-xs font-medium ${
                  pickupMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                }`}
              >
                {pickupMsg.text}
              </div>
            )}

            <div className="space-y-2.5">
              {pickupLocations.length === 0 ? (
                <p className="text-xs text-[#2A0912]/60 text-center py-4">
                  Belum ada cabang pengambilan terdaftar.
                </p>
              ) : (
                pickupLocations.map((loc) => {
                  const isDisabled = (
                    settings.bookingForm.disabledPickupIds || []
                  ).includes(String(loc.id));
                  const isActive = !isDisabled && loc.is_active !== false;
                  const isConfirmingDelete =
                    String(confirmDeletePickupId) === String(loc.id);

                  return (
                    <div
                      key={loc.id}
                      className={`p-3.5 rounded-xl border space-y-2 ${
                        isActive
                          ? 'bg-white border-[#6B1D2F]/15'
                          : 'bg-neutral-50 border-neutral-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="text-xs sm:text-sm font-bold text-[#2A0912]">
                            {loc.name}
                          </h3>
                          <p className="text-[11px] text-[#2A0912]/70 mt-0.5 leading-relaxed">
                            {loc.address}
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => onTogglePickupActive(loc.id)}
                            className={`px-2 py-1 rounded-lg text-[11px] font-semibold border ${
                              isActive
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                            }`}
                          >
                            {isActive ? 'Aktif' : 'Nonaktif'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingPickupId(loc.id);
                              setPickupName(loc.name);
                              setPickupAddress(loc.address);
                              setPickupMsg(null);
                            }}
                            className="p-1.5 rounded-lg bg-[#F9E4E8] text-[#6B1D2F] hover:bg-[#F3D2D8]"
                            aria-label={`Edit cabang ${loc.name}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmDeletePickupId(
                                isConfirmingDelete ? null : loc.id
                              )
                            }
                            className="p-1.5 rounded-lg bg-red-50 text-red-700 hover:bg-red-100"
                            aria-label={`Hapus cabang ${loc.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {isConfirmingDelete && (
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-red-200 text-[11px]">
                          <span className="text-red-800 font-medium">
                            Hapus cabang ini dari daftar?
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePickupId(null)}
                              className="px-2 py-1 rounded-md border border-neutral-300 text-neutral-700 font-semibold"
                            >
                              Batal
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfirmDeletePickup(loc.id)}
                              className="px-2 py-1 rounded-md bg-red-700 text-white font-semibold"
                            >
                              Ya, Hapus
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
