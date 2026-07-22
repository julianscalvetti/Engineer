import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

interface ServerEnv {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export function createSupabaseAdminClient(envPath = ".env.local"): SupabaseClient {
  const env = loadEnvFile(envPath);
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function checkSupabaseAdminEnv(envPath = ".env.local") {
  const env = loadEnvFile(envPath);
  return {
    NEXT_PUBLIC_SUPABASE_URL_PRESENT: Boolean(env.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_PRESENT: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

function loadEnvFile(envPath: string): ServerEnv {
  const values: ServerEnv = {};
  const content = readFileSync(envPath, "utf8");

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (key === "NEXT_PUBLIC_SUPABASE_URL") values.NEXT_PUBLIC_SUPABASE_URL = value;
    if (key === "SUPABASE_SERVICE_ROLE_KEY") values.SUPABASE_SERVICE_ROLE_KEY = value;
  }

  return values;
}
