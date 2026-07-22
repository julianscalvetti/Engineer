import { createClient } from "@supabase/supabase-js";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getActiveTenantContext } from "../tenant/context";
import type { EngineerClientContext, EngineerRuntime } from "./types";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localEnvPath = resolve(repositoryRoot, ".env.local");

let loadedLocalEnv = false;

export function readEngineerRuntimeFromEnv(env: NodeJS.ProcessEnv = process.env): EngineerRuntime {
  loadEngineerLocalEnv();

  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const accessToken = env.ENGINEER_SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
  const email = env.ENGINEER_SUPABASE_EMAIL;
  const password = env.ENGINEER_SUPABASE_PASSWORD;

  if (!supabaseUrl) throw new Error("Falta SUPABASE_URL o NEXT_PUBLIC_SUPABASE_URL.");
  if (!publishableKey) {
    throw new Error("Falta SUPABASE_PUBLISHABLE_KEY o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  assertPublishableKey(publishableKey);

  if (accessToken) {
    return {
      supabaseUrl,
      publishableKey,
      auth: {
        mode: "access_token",
        accessToken,
      },
    };
  }

  if (!email) throw new Error("Falta ENGINEER_SUPABASE_EMAIL.");
  if (!password) throw new Error("Falta ENGINEER_SUPABASE_PASSWORD.");

  return {
    supabaseUrl,
    publishableKey,
    auth: {
      mode: "password",
      email,
      password,
    },
  };
}

export async function createEngineerClientContext(runtime: EngineerRuntime): Promise<EngineerClientContext> {
  const supabase = createClient(runtime.supabaseUrl, runtime.publishableKey, {
    auth: {
      autoRefreshToken: runtime.auth.mode === "password",
      detectSessionInUrl: false,
      persistSession: false,
    },
    global:
      runtime.auth.mode === "access_token"
        ? {
            headers: {
              Authorization: `Bearer ${runtime.auth.accessToken}`,
            },
          }
        : undefined,
  });

  if (runtime.auth.mode === "access_token") {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(runtime.auth.accessToken);

    if (error || !user) {
      throw new Error("No se pudo autenticar ENGINEER_SUPABASE_ACCESS_TOKEN.");
    }

    return { supabase, accessToken: runtime.auth.accessToken };
  } else {
    const { error } = await supabase.auth.signInWithPassword({
      email: runtime.auth.email,
      password: runtime.auth.password,
    });

    if (error) {
      throw new Error(`No se pudo autenticar ENGINEER_SUPABASE_EMAIL: ${error.message}`);
    }
  }

  return { supabase };
}

export async function validateEngineerStartup(context: EngineerClientContext) {
  const tenant = await getActiveTenantContext(context.supabase, { accessToken: context.accessToken });

  if (tenant.status !== "ready") {
    throw new Error(tenant.message);
  }
  if (tenant.company.name !== "ROMET") {
    throw new Error(`Empresa activa inesperada: ${tenant.company.name}. Se esperaba ROMET.`);
  }
  if (tenant.plant.name !== "Planta Principal") {
    throw new Error(`Planta activa inesperada: ${tenant.plant.name}. Se esperaba Planta Principal.`);
  }

  return tenant;
}

export function getEngineerRepositoryRoot() {
  return repositoryRoot;
}

export function loadEngineerLocalEnv() {
  if (loadedLocalEnv) return;
  loadedLocalEnv = true;

  if (!existsSync(localEnvPath)) return;
  process.loadEnvFile(localEnvPath);
}

function assertPublishableKey(key: string) {
  if (key.startsWith("sb_secret_")) {
    throw new Error("El MCP no acepta service role ni secret keys. Usa una publishable/anon key.");
  }

  const payload = decodeJwtPayload(key);
  if (payload && payload.role === "service_role") {
    throw new Error("El MCP no acepta service role. Usa una publishable/anon key.");
  }
}

function decodeJwtPayload(value: string): { role?: unknown } | null {
  const [, payload] = value.split(".");
  if (!payload) return null;

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as { role?: unknown };
  } catch {
    return null;
  }
}
