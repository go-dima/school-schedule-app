import { createClient } from "@supabase/supabase-js";
import { env } from "../utils/env";

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: "admin" | "parent" | "child" | "staff";
          approved: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: "admin" | "parent" | "child" | "staff";
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: "admin" | "parent" | "child" | "staff";
          approved?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      time_slots: {
        Row: {
          id: string;
          name: string;
          start_time: string;
          end_time: string;
          day_of_week: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          start_time: string;
          end_time: string;
          day_of_week: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          start_time?: string;
          end_time?: string;
          day_of_week?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      classes: {
        Row: {
          id: string;
          title: string;
          description: string;
          teacher: string;
          time_slot_id: string;
          grade: number;
          is_mandatory: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          teacher: string;
          time_slot_id: string;
          grade: number;
          is_mandatory?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          teacher?: string;
          time_slot_id?: string;
          grade?: number;
          is_mandatory?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      schedule_selections: {
        Row: {
          id: string;
          user_id: string;
          class_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          class_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          class_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: "admin" | "parent" | "child" | "staff";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
