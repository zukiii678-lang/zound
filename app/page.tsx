import { getSounds } from "@/lib/supabase";
import Library from "@/components/Library";

export default async function Home() {
  const sounds = await getSounds();
  return <Library sounds={sounds} />;
}
