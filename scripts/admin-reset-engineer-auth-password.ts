import { createClient } from "@supabase/supabase-js";
import { resolve } from "node:path";

interface CliArgs {
  userId?: string;
  expectedEmail?: string;
  envPath?: string;
}

const args = parseArgs(process.argv.slice(2));
const envPath = resolve(args.envPath ?? process.env.ENGINEER_ENV_PATH ?? ".env.local");
process.loadEnvFile(envPath);

const userId = args.userId ?? requiredEnv("ENGINEER_SUPABASE_USER_ID");
const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
const publishableKey = requiredEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
const email = requiredEnv("ENGINEER_SUPABASE_EMAIL");
const expectedEmail = args.expectedEmail ?? email;
const password = requiredEnv("ENGINEER_SUPABASE_PASSWORD");

void main();

async function main() {
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const result = {
    userFound: false,
    emailMatches: false,
    userBlocked: false,
    passwordUpdated: false,
    signInWithPassword: false,
  };

  const { data: userData, error: getUserError } = await admin.auth.admin.getUserById(userId);
  if (getUserError) throw new Error(`No se pudo buscar el usuario: ${getUserError.message}`);

  const user = userData.user;
  result.userFound = Boolean(user);
  result.emailMatches = user?.email === expectedEmail && email === expectedEmail;
  result.userBlocked = isBlocked(user?.banned_until);

  if (!result.userFound) throw new Error("Usuario no encontrado.");
  if (!result.emailMatches) throw new Error("El email del usuario no coincide con el email esperado.");
  if (result.userBlocked) throw new Error("El usuario esta bloqueado.");

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    password,
    email_confirm: true,
  });

  if (updateError) throw new Error(`No se pudo actualizar la password del usuario: ${updateError.message}`);
  result.passwordUpdated = true;

  const { error: signInError } = await authClient.auth.signInWithPassword({
    email,
    password,
  });

  if (!signInError) result.signInWithPassword = true;

  console.log(JSON.stringify(result, null, 2));
}

function parseArgs(values: string[]): CliArgs {
  const result: CliArgs = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    const value = values[index + 1];
    if (!key.startsWith("--") || !value) continue;
    index += 1;
    if (key === "--user-id") result.userId = value;
    if (key === "--expected-email") result.expectedEmail = value;
    if (key === "--env-path") result.envPath = value;
  }
  return result;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function isBlocked(bannedUntil: string | null | undefined) {
  if (!bannedUntil) return false;
  const bannedUntilDate = new Date(bannedUntil);
  return Number.isFinite(bannedUntilDate.getTime()) && bannedUntilDate.getTime() > Date.now();
}
