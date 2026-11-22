import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://uheaccocgzprkjkdetmo.supabase.co';

export const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_mbjQxYHCYpy1OVJPanMTzg_zoBy6IeA';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export const SUPABASE_PERMISSION_SQL = `-- Jalankan di Supabase SQL Editor untuk mengaktifkan akses tabel bagi role anon:
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kebayas TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pickup_locations TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bookings TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Jika Row Level Security (RLS) aktif, pastikan policy tersedia:
ALTER TABLE public.kebayas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read kebayas" ON public.kebayas FOR SELECT USING (true);
CREATE POLICY "Public insert kebayas" ON public.kebayas FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update kebayas" ON public.kebayas FOR UPDATE USING (true);
CREATE POLICY "Public delete kebayas" ON public.kebayas FOR DELETE USING (true);
CREATE POLICY "Public read pickup_locations" ON public.pickup_locations FOR SELECT USING (true);
CREATE POLICY "Public insert pickup_locations" ON public.pickup_locations FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update pickup_locations" ON public.pickup_locations FOR UPDATE USING (true);
CREATE POLICY "Public delete pickup_locations" ON public.pickup_locations FOR DELETE USING (true);
CREATE POLICY "Public read bookings" ON public.bookings FOR SELECT USING (true);
CREATE POLICY "Public insert bookings" ON public.bookings FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bookings" ON public.bookings FOR UPDATE USING (true);
CREATE POLICY "Public delete bookings" ON public.bookings FOR DELETE USING (true);`;
