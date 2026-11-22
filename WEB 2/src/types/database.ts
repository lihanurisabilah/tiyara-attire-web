export type KebayaCategory = 'Wisuda' | 'Lamaran' | 'Akad Nikah' | 'Kondangan' | string;

export type BookingStatus =
  | 'Pending Verification'
  | 'Confirmed'
  | 'Rented'
  | 'Returned'
  | string;

export type DeliveryMethod = 'Pickup Store' | string;

export interface Kebaya {
  id: string | number;
  name: string;
  category: KebayaCategory;
  size: string;
  price_per_3days: number;
  stock: number;
  description: string;
  image_url: string;
  rating: number;
  rental_benefits?: string | null;
  rental_terms?: string | null;
}

export interface PickupLocation {
  id: string | number;
  name: string;
  address: string;
  is_active?: boolean | null;
}

export interface Booking {
  id?: string | number;
  booking_code: string;
  customer_name: string;
  customer_phone: string;
  customer_address?: string | null;
  kebaya_id: string | number;
  duration_days: number;
  start_date: string;
  end_date: string;
  delivery_method: DeliveryMethod;
  pickup_location_id: string | number | null;
  delivery_address: string | null;
  subtotal: number;
  deposit_security: number;
  grand_total: number;
  payment_proof_url: string | null;
  status: BookingStatus;
  created_at?: string;
}

export interface BookingWithDetails extends Booking {
  kebaya?: Kebaya | null;
  pickup_location?: PickupLocation | null;
}
