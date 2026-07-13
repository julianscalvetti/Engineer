export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  company_id: string;
  full_name: string | null;
  role: "admin" | "member";
  created_at: string;
  updated_at: string;
};

export type ProductRow = {
  id: string;
  company_id: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: CompanyRow;
        Insert: Pick<CompanyRow, "name" | "slug"> & Partial<Pick<CompanyRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<Omit<CompanyRow, "id">>;
        Relationships: [];
      };
      profiles: {
        Row: ProfileRow;
        Insert: Pick<ProfileRow, "id" | "company_id"> & Partial<Pick<ProfileRow, "full_name" | "role" | "created_at" | "updated_at">>;
        Update: Partial<Omit<ProfileRow, "id" | "company_id">>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Pick<ProductRow, "company_id" | "code" | "name"> & Partial<Pick<ProductRow, "id" | "description" | "active" | "created_at" | "updated_at">>;
        Update: Partial<Omit<ProductRow, "id" | "company_id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      bootstrap_company: {
        Args: { company_name: string; full_name?: string | null };
        Returns: string;
      };
      current_company_id: {
        Args: Record<PropertyKey, never>;
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
