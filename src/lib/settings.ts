import { SiteContentSettings } from '../types/settings';

const SETTINGS_STORAGE_KEY = 'tiyara_site_settings_v1';

export const DEFAULT_SITE_SETTINGS: SiteContentSettings = {
  brand: {
    logoUrl: '',
  },
  browse: {
    heroTitle: 'Tiyara Attire',
    heroSubtitle: 'Koleksi Kebaya Kurasi · Sewa 3 Hari Fleksibel',
    searchPlaceholder: 'Cari kebaya wisuda, akad, lamaran...',
    bannerTag: 'Koleksi Signature 2026',
    bannerTitle: 'Anggun di Setiap Momen Istimewa',
    bannerSubtitle: 'Sudah laundry uap & gratis selendang serasi',
    categories: [
      { id: 'Semua', label: 'Semua', iconKey: 'sparkles' },
      { id: 'Wisuda', label: 'Wisuda', iconKey: 'graduation' },
      { id: 'Lamaran', label: 'Lamaran', iconKey: 'heart' },
      { id: 'Akad Nikah', label: 'Akad Nikah', iconKey: 'crown' },
      { id: 'Kondangan', label: 'Kondangan', iconKey: 'gem' },
    ],
  },
  promos: [
    {
      id: 'promo-wisuda-2026',
      title: 'Gratis Selendang Sutra & Bros Gold untuk Setiap Reservasi',
      description:
        'Setiap penyewaan kebaya minimal 3 hari sudah termasuk layanan laundry uap premium, pewangi khusus butik, dan aksesori pelengkap tanpa biaya tambahan.',
      codeOrTerms: 'PROMO WISUDA · MIN. 3 HARI',
      validPeriod: 'Berlaku s/d 31 Desember 2026',
      targetCategory: 'Wisuda',
      active: true,
      highlight: true,
    },
    {
      id: 'promo-akad-durasi',
      title: 'Fleksibilitas Tambah Durasi Kelipatan 3 Hari',
      description:
        'Butuh waktu persiapan acara di luar kota? Atur durasi sewa 6 hingga 12 hari dengan tarif kelipatan 3 hari yang transparan.',
      codeOrTerms: 'TIYARA-AKAD',
      validPeriod: 'Berlaku sepanjang tahun 2026',
      targetCategory: 'Akad Nikah',
      active: true,
      highlight: false,
    },
    {
      id: 'promo-deposit-aman',
      title: '100% Pengembalian Deposit Keamanan',
      description:
        'Deposit Rp 100.000 dikembalikan penuh setelah kebaya diterima kembali dalam kondisi baik oleh tim butik kami.',
      codeOrTerms: 'DEPOSIT Rp 100.000',
      validPeriod: 'Berlaku untuk seluruh transaksi',
      targetCategory: 'Semua',
      active: true,
      highlight: false,
    },
  ],
  contact: {
    boutiqueAddress: 'Jl. Kemang Raya No. 48, Kebayoran Baru, Jakarta Selatan',
    whatsappNumber: '+62 811-8890-2026',
    email: 'concierge@tiyaraattire.id',
    operationalHours: 'Setiap hari · 09.00 – 20.00 WIB',
    instagramUrl: 'https://instagram.com/tiyaraattire',
    mapsUrl: 'https://maps.google.com/?q=Jl.+Kemang+Raya+No.+48+Jakarta+Selatan',
  },
  bookingForm: {
    formTitle: 'Form Reservasi Sewa',
    pickupNote:
      'Pengambilan dan pengembalian kebaya dilakukan langsung di cabang butik Tiyara Attire yang Anda pilih.',
    customerDataNote:
      'Isi Nama Lengkap, Nomor WhatsApp aktif, dan Alamat Lengkap domisili sesuai identitas untuk keperluan verifikasi pengambilan di butik.',
    bankTransferNote:
      'Silakan transfer sesuai Grand Total ke salah satu rekening resmi Tiyara Attire atau gunakan QRIS berikut:',
    bank1Label: 'Bank BCA · a.n. Tiyara Attire',
    bank1Number: '8008129839',
    bank2Label: 'Bank Mandiri · a.n. Tiyara Attire',
    bank2Number: '12379834983281',
    qrisInfo:
      'QRIS Tiyara Attire (NMID: ID1026008819204) — scan melalui mobile banking / e-wallet atau konfirmasi via WhatsApp admin.',
    paymentConfirmationNote:
      'Setelah mengunggah bukti transfer DP, pesanan akan diverifikasi tim admin dan ringkasan reservasi otomatis diteruskan ke WhatsApp resmi kami. Sisa pembayaran dilunasi saat pengambilan kebaya di butik.',
    dpPercentage: 50,
    disabledPickupIds: [],
  },
  kebayaPolicies: {
    rentalBenefits: [
      'Sudah Laundry Uap & Wangi Butik — disterilkan profesional sebelum diambil.',
      'Free Selendang / Aksesoris Serasi — pelengkap klasik selama masa sewa.',
      'Durasi Sewa Fleksibel Kelipatan 3 Hari — bisa diperpanjang sesuai kebutuhan acara.',
      'Gratis Fitting Ringan di Butik — penyesuaian pin/jarum nyaman saat pengambilan.',
    ].join('\n'),
    rentalTerms: [
      'Durasi penyewaan minimal 3 hari (kelipatan 3 hari). Pengambilan & pengembalian dilakukan langsung di cabang Tiyara Attire dengan menunjukkan kode booking dan identitas aktif.',
      'Uang jaminan keamanan (deposit) Rp 100.000 dibayarkan bersama total sewa dan dikembalikan 100% setelah kebaya diterima kembali dalam kondisi baik.',
      'Keterlambatan pengembalian melewati jadwal selesai sewa dikenakan biaya penyesuaian harian sesuai tarif yang berlaku di butik.',
      'Mohon tidak mencuci, menyetrika langsung bagian payet/brokat, atau memotong jahitan kebaya. Perawatan ditangani penuh oleh tim butik kami.',
    ].join('\n'),
  },
  kebayaOverrides: {},
};

export function loadSiteSettings(): SiteContentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SITE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<SiteContentSettings>;
    return {
      brand: {
        ...DEFAULT_SITE_SETTINGS.brand,
        ...(parsed.brand || {}),
        logoUrl:
          typeof parsed.brand?.logoUrl === 'string'
            ? parsed.brand.logoUrl
            : '',
      },
      browse: {
        ...DEFAULT_SITE_SETTINGS.browse,
        ...(parsed.browse || {}),
        categories:
          Array.isArray(parsed.browse?.categories) &&
          parsed.browse.categories.length > 0
            ? parsed.browse.categories
            : DEFAULT_SITE_SETTINGS.browse.categories,
      },
      promos: Array.isArray(parsed.promos)
        ? parsed.promos
        : DEFAULT_SITE_SETTINGS.promos,
      contact: {
        ...DEFAULT_SITE_SETTINGS.contact,
        ...(parsed.contact || {}),
      },
      bookingForm: {
        ...DEFAULT_SITE_SETTINGS.bookingForm,
        ...(parsed.bookingForm || {}),
        dpPercentage:
          typeof parsed.bookingForm?.dpPercentage === 'number' &&
          parsed.bookingForm.dpPercentage >= 10 &&
          parsed.bookingForm.dpPercentage <= 90
            ? parsed.bookingForm.dpPercentage
            : DEFAULT_SITE_SETTINGS.bookingForm.dpPercentage,
        disabledPickupIds: Array.isArray(parsed.bookingForm?.disabledPickupIds)
          ? parsed.bookingForm.disabledPickupIds
          : [],
      },
      kebayaPolicies: {
        ...DEFAULT_SITE_SETTINGS.kebayaPolicies,
        ...(parsed.kebayaPolicies || {}),
      },
      kebayaOverrides:
        parsed.kebayaOverrides && typeof parsed.kebayaOverrides === 'object'
          ? parsed.kebayaOverrides
          : {},
    };
  } catch {
    return DEFAULT_SITE_SETTINGS;
  }
}

export function saveSiteSettings(settings: SiteContentSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage quota errors
  }
}
