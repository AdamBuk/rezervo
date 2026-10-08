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
            foreignKeyName: "bookings_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      get_busy_intervals: {
        Args: { p_business_id: string; p_from: string; p_to: string };
        Returns: { starts_at: string; ends_at: string }[];
      };
      create_booking: {
        Args: {
          p_business_id: string;
          p_service_id: string;
          p_starts_at: string;
          p_customer_name: string;
          p_customer_email: string;
          p_customer_phone: string;
        };
        Returns: string;
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
