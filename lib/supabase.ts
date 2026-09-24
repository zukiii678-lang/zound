import { createClient } from "@supabase/supabase-js";

export type Sound = {
  id: string;
  title: string;
  category: string;
  file_url: string;
  duration: number;
  license_type: "CC0" | "Royalty-Free" | "CC BY" | string;
  source: string;
  created_at?: string;
};

export const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)
  : null;

export async function getSounds(): Promise<Sound[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("sounds").select("*").order("created_at", { ascending: false });
  if (error) { console.error("Supabase sounds query failed:", error.message); return []; }
  return (data ?? []) as Sound[];
}
