"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/client";
import styles from "./auth-shell.module.css";

type AuthShellProps = {
  children: ReactNode;
  profile: UserProfile | null;
};

export function AuthShell({ children, profile }: AuthShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const currentProfile = profile;

  async function logout() {
    setLoggingOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  if (!currentProfile || pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className={styles.shell}>
      <nav className={styles.nav} aria-label="Navegacion principal">
        <div className={styles.navInner}>
          <Link className={styles.brand} href="/dashboard">
            Engineer
          </Link>
          <div className={styles.links}>
            <NavLink href="/dashboard" label="Dashboard" pathname={pathname} />
            <NavLink href="/controles/nuevo" label="Nuevo control" pathname={pathname} />
            <NavLink href="/controles" label="Historial" pathname={pathname} />
            <NavLink href="/asistente" label="Asistente" pathname={pathname} />
            {currentProfile.role === "ingeniero" ? (
              <NavLink href="/configuracion" label="Configuracion" pathname={pathname} />
            ) : null}
          </div>
          <div className={styles.userArea}>
            <span className={styles.userName}>{currentProfile.name}</span>
            <button className={styles.button} type="button" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Cerrando..." : "Cerrar sesion"}
            </button>
          </div>
        </div>
      </nav>
      {children}
    </div>
  );
}

function NavLink({ href, label, pathname }: { href: string; label: string; pathname: string }) {
  const isActive = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <Link className={`${styles.link} ${isActive ? styles.activeLink : ""}`} href={href}>
      {label}
    </Link>
  );
}
