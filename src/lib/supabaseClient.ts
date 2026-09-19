import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://dgbbwyztbqkystnjvkly.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_ANON_KEY in environment variables.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || "");