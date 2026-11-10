/**
 * Database types. Hand-written to match supabase/migrations until the Supabase project exists.
 * After linking the project, regenerate with `npm run db:types` (it overwrites this file).
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type EventRow = {
  id: string;
  admin_id: string;
  title: string;
  description: string;
  date_time: string;
  venue: string;
  capacity: number;
  status: "draft" | "published";
  created_at: string;
};

type RegistrationRow = {
  id: string;
  event_id: string;
  full_name: string;
  email: string;
  organization: string;
  contact_number: string;
  qr_token: string;
  email_status: "pending" | "sent" | "failed";
  checked_in_at: string | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      events: {
        Row: EventRow;
        Insert: Omit<EventRow, "id" | "created_at" | "status" | "description"> & Partial<Pick<EventRow, "id" | "created_at" | "status" | "description">>;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      registrations: {
        Row: RegistrationRow;
        Insert: Omit<RegistrationRow, "id" | "created_at" | "email_status" | "checked_in_at"> &
          Partial<Pick<RegistrationRow, "id" | "created_at" | "email_status" | "checked_in_at">>;
        Update: Partial<RegistrationRow>;
        Relationships: [
          { foreignKeyName: "registrations_event_id_fkey"; columns: ["event_id"]; isOneToOne: false; referencedRelation: "events"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      register_for_event: {
        Args: {
          p_event_id: string;
          p_full_name: string;
          p_email: string;
          p_organization: string;
          p_contact_number: string;
          p_qr_token: string;
        };
        Returns: RegistrationRow;
      };
    };
    Enums: { event_status: "draft" | "published"; email_status: "pending" | "sent" | "failed" };
    CompositeTypes: { [_ in never]: never };
  };
};
