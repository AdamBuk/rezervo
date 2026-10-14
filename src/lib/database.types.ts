// Mirrors supabase/migrations. Regenerate with:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "13.0.5";
  };
  public: {
    Tables: {
      businesses: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          slug: string;
          description: string | null;
          address: string | null;
          phone: string | null;
          notification_email: string;
          timezone: string;
          slot_step_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          slug: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          notification_email: string;
          timezone?: string;
          slot_step_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          address?: string | null;
          phone?: string | null;
          notification_email?: string;
          timezone?: string;
          slot_step_minutes?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      services: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          description: string | null;
          duration_minutes: number;
          price_czk: number;
          is_active: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          description?: string | null;
          duration_minutes: number;
          price_czk: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          description?: string | null;
          duration_minutes?: number;
          price_czk?: number;
          is_active?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      opening_hours: {
        Row: {
          business_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
        };
        Insert: {
          business_id: string;
          weekday: number;
          opens_at: string;
          closes_at: string;
        };
        Update: {
          business_id?: string;
          weekday?: number;
          opens_at?: string;
          closes_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "opening_hours_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      bookings: {
        Row: {
          id: string;
          business_id: string;
          service_id: string;
          staff_id: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          starts_at: string;
          ends_at: string;
          status: "confirmed" | "cancelled";
          reminder_sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          service_id: string;
          staff_id: string;
          customer_name: string;
          customer_email: string;
          customer_phone: string;
          starts_at: string;
          ends_at: string;
          status?: "confirmed" | "cancelled";
          reminder_sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          service_id?: string;
          staff_id?: string;
          customer_name?: string;
          customer_email?: string;
          customer_phone?: string;
          starts_at?: string;
          ends_at?: string;
          status?: "confirmed" | "cancelled";
          reminder_sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bookings_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          id: string;
          business_id: string;
          key_hash: string;
          key_prefix: string;
          key_ciphertext: string;
          created_at: string;
          last_used_at: string | null;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          business_id: string;
          key_hash: string;
          key_prefix: string;
          key_ciphertext: string;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          business_id?: string;
          key_hash?: string;
          key_prefix?: string;
          key_ciphertext?: string;
          created_at?: string;
          last_used_at?: string | null;
          revoked_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      closures: {
        Row: {
          id: string;
          business_id: string;
          /** null = the whole business is closed */
          staff_id: string | null;
          starts_on: string;
          ends_on: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          staff_id?: string | null;
          starts_on: string;
          ends_on: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          staff_id?: string | null;
          starts_on?: string;
          ends_on?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "closures_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "closures_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff: {
        Row: {
          id: string;
          business_id: string;
          name: string;
          is_active: boolean;
          uses_business_hours: boolean;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          business_id: string;
          name: string;
          is_active?: boolean;
          uses_business_hours?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          business_id?: string;
          name?: string;
          is_active?: boolean;
          uses_business_hours?: boolean;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_services: {
        Row: { staff_id: string; service_id: string };
        Insert: { staff_id: string; service_id: string };
        Update: { staff_id?: string; service_id?: string };
        Relationships: [
          {
            foreignKeyName: "staff_services_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "staff_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      staff_hours: {
        Row: { staff_id: string; weekday: number; opens_at: string; closes_at: string };
        Insert: { staff_id: string; weekday: number; opens_at: string; closes_at: string };
        Update: { staff_id?: string; weekday?: number; opens_at?: string; closes_at?: string };
        Relationships: [
          {
            foreignKeyName: "staff_hours_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      api_rate_limits: {
        Row: { bucket: string; window_start: string; hits: number };
        Insert: { bucket: string; window_start: string; hits?: number };
        Update: { bucket?: string; window_start?: string; hits?: number };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_staff_busy_intervals: {
        Args: { p_business_id: string; p_from: string; p_to: string };
        Returns: { staff_id: string; starts_at: string; ends_at: string }[];
      };
      create_booking: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_starts_at: string;
          p_customer_name: string;
          p_customer_email: string;
          p_customer_phone: string;
          p_staff_id?: string | null;
        };
        Returns: string;
      };
      rotate_api_key: {
        Args: { p_key_hash: string; p_key_prefix: string; p_key_ciphertext: string };
        Returns: string;
      };
      api_rate_limit_hit: {
        Args: { p_bucket: string; p_limit: number; p_window_seconds: number };
        Returns: { allowed: boolean; remaining: number; reset_at: string }[];
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type PublicTables = Database["public"]["Tables"];
export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"];

export type Business = Tables<"businesses">;
export type Service = Tables<"services">;
export type OpeningHours = Tables<"opening_hours">;
export type Booking = Tables<"bookings">;
export type ApiKey = Tables<"api_keys">;
export type Closure = Tables<"closures">;
export type Staff = Tables<"staff">;
export type StaffHours = Tables<"staff_hours">;
