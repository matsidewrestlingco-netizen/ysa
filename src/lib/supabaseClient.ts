import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
<<<<<<< Updated upstream
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
=======
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
>>>>>>> Stashed changes
);
