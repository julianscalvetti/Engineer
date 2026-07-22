export type UserRole = "operativo" | "ingeniero";

export type UserProfile = {
  id: string;
  name: string;
  role: UserRole;
};

export function isUserRole(role: string | null | undefined): role is UserRole {
  return role === "operativo" || role === "ingeniero";
}
