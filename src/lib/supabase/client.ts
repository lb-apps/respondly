import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";

/**
 * The browser client.
 *
 * `NEXT_PUBLIC_*` values are inlined at build time, so a deployment missing one
 * fails while prerendering a page that signs people in — and the library's own
 * message ("Your project's URL and API key are required") names neither the
 * variable nor where to set it. Say which one is missing instead.
 */
export function createClient() {
  const missing = [
    !supabaseUrl && "NEXT_PUBLIC_SUPABASE_URL",
    !supabasePublishableKey && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  ].filter(Boolean);

  if (missing.length > 0) {
    throw new Error(
      `Supabase is not configured: ${missing.join(", ")} missing. ` +
        `Set it in .env.local locally, and in the Vercel project's environment ` +
        `variables for a deployment — see .env.example.`
    );
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
