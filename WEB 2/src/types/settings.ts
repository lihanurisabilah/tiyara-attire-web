export type CategoryIconKey =
  | 'sparkles'
  | 'graduation'
  | 'heart'
  | 'crown'
  | 'gem';

export interface CustomerCategoryConfig {
  id: string;
  label: string;
  iconKey: CategoryIconKey;
}

export interface BrowseContentSettings {
  heroTitle: string;
  heroSubtitle: string;
  searchPlaceholder: string;
  bannerTag: string;
  bannerTitle: string;
  bannerSubtitle: string;
  categories: CustomerCategoryConfig[];
}

export interface PromoItemConfig {
  id: string;
  title: string;
  description: string;
  codeOrTerms: string;
  validPeriod: string;
  targetCategory: string;
  active: boolean;
  highlight?: boolean;
}

export interface ContactContentSettings {
  boutiqueAddress: string;
  whatsappNumber: string;
  email: string;
  operationalHours: string;
  instagramUrl: string;
  mapsUrl: string;
}

export interface KebayaPoliciesSettings {
  rentalBenefits: string;
  rentalTerms: string;
}

export interface KebayaOverridePolicy {
  rentalBenefits?: string;
  rentalTerms?: string;
}

export interface BookingFormContentSettings {
  formTitle: string;
  pickupNote: string;
  customerDataNote: string;
  bankTransferNote: string;
  bank1Label: string;
  bank1Number: string;
  bank2Label: string;
  bank2Number: string;
  qrisInfo: string;
  paymentConfirmationNote: string;
  disabledPickupIds: string[];
}

export interface SiteContentSettings {
  browse: BrowseContentSettings;
  promos: PromoItemConfig[];
  contact: ContactContentSettings;
  bookingForm: BookingFormContentSettings;
  kebayaPolicies: KebayaPoliciesSettings;
  kebayaOverrides: Record<string, KebayaOverridePolicy>;
}
