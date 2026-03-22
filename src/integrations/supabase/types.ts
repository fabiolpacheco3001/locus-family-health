export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      allergies: {
        Row: {
          created_at: string
          family_member_id: string
          id: string
          severity: string
          substance: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_member_id: string
          id?: string
          severity?: string
          substance: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_member_id?: string
          id?: string
          severity?: string
          substance?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "allergies_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          consultation_date: string | null
          created_at: string
          family_member_id: string
          id: string
          professional_name: string | null
          questions: string | null
          specialty: string
          status: string
          symptoms: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          consultation_date?: string | null
          created_at?: string
          family_member_id: string
          id?: string
          professional_name?: string | null
          questions?: string | null
          specialty: string
          status?: string
          symptoms?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          consultation_date?: string | null
          created_at?: string
          family_member_id?: string
          id?: string
          professional_name?: string | null
          questions?: string | null
          specialty?: string
          status?: string
          symptoms?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      diseases: {
        Row: {
          category: string
          created_at: string
          diagnosed_at: string | null
          family_member_id: string
          id: string
          name: string
          notes: string | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          diagnosed_at?: string | null
          family_member_id: string
          id?: string
          name: string
          notes?: string | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          diagnosed_at?: string | null
          family_member_id?: string
          id?: string
          name?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "diseases_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          consultation_id: string | null
          created_at: string
          exam_date: string | null
          family_member_id: string
          file_url: string | null
          id: string
          location: string | null
          name: string
          result_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string
          exam_date?: string | null
          family_member_id: string
          file_url?: string | null
          id?: string
          location?: string | null
          name: string
          result_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          consultation_id?: string | null
          created_at?: string
          exam_date?: string | null
          family_member_id?: string
          file_url?: string | null
          id?: string
          location?: string | null
          name?: string
          result_date?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exams_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          birth_date: string | null
          blood_type: string | null
          created_at: string
          gender: string | null
          id: string
          name: string
          relationship: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          relationship: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          blood_type?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          relationship?: string
          user_id?: string
        }
        Relationships: []
      }
      medications: {
        Row: {
          consultation_id: string | null
          created_at: string
          dosage: string | null
          duration: string | null
          duration_days: number | null
          end_date: string | null
          family_member_id: string
          frequency: string | null
          frequency_hours: number | null
          id: string
          name: string
          start_date: string | null
          start_time: string | null
          status: string
          user_id: string
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          family_member_id: string
          frequency?: string | null
          frequency_hours?: number | null
          id?: string
          name: string
          start_date?: string | null
          start_time?: string | null
          status?: string
          user_id: string
        }
        Update: {
          consultation_id?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          family_member_id?: string
          frequency?: string | null
          frequency_hours?: number | null
          id?: string
          name?: string
          start_date?: string | null
          start_time?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medications_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medications_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          family_member_id: string | null
          id: string
          is_read: boolean | null
          message: string
          scheduled_for: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          is_read?: boolean | null
          message: string
          scheduled_for: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string | null
          family_member_id?: string | null
          id?: string
          is_read?: boolean | null
          message?: string
          scheduled_for?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      vaccines: {
        Row: {
          applied_date: string | null
          batch: string | null
          booster_date: string | null
          created_at: string
          family_member_id: string
          id: string
          name: string
          side_effects: string | null
          user_id: string
        }
        Insert: {
          applied_date?: string | null
          batch?: string | null
          booster_date?: string | null
          created_at?: string
          family_member_id: string
          id?: string
          name: string
          side_effects?: string | null
          user_id: string
        }
        Update: {
          applied_date?: string | null
          batch?: string | null
          booster_date?: string | null
          created_at?: string
          family_member_id?: string
          id?: string
          name?: string
          side_effects?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vaccines_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
