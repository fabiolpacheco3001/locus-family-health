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
          group_id: string | null
          id: string
          severity: string
          substance: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_member_id: string
          group_id?: string | null
          id?: string
          severity?: string
          substance: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_member_id?: string
          group_id?: string | null
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
          {
            foreignKeyName: "allergies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      blood_pressure_history: {
        Row: {
          consultation_id: string | null
          created_at: string
          diastolic: number
          familiar_id: string
          group_id: string | null
          id: string
          measurement_date: string
          notes: string | null
          source: string
          systolic: number
          user_id: string
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string
          diastolic: number
          familiar_id: string
          group_id?: string | null
          id?: string
          measurement_date?: string
          notes?: string | null
          source?: string
          systolic: number
          user_id: string
        }
        Update: {
          consultation_id?: string | null
          created_at?: string
          diastolic?: number
          familiar_id?: string
          group_id?: string | null
          id?: string
          measurement_date?: string
          notes?: string | null
          source?: string
          systolic?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_pressure_history_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          cancel_reason: string | null
          consultation_date: string | null
          created_at: string
          family_member_id: string
          group_id: string | null
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
          cancel_reason?: string | null
          consultation_date?: string | null
          created_at?: string
          family_member_id: string
          group_id?: string | null
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
          cancel_reason?: string | null
          consultation_date?: string | null
          created_at?: string
          family_member_id?: string
          group_id?: string | null
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
          {
            foreignKeyName: "consultations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
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
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
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
          {
            foreignKeyName: "diseases_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      exams: {
        Row: {
          cancel_reason: string | null
          consultation_id: string | null
          created_at: string
          exam_date: string | null
          family_member_id: string
          file_url: string | null
          group_id: string | null
          id: string
          location: string | null
          name: string
          result_date: string | null
          status: string
          user_id: string
        }
        Insert: {
          cancel_reason?: string | null
          consultation_id?: string | null
          created_at?: string
          exam_date?: string | null
          family_member_id: string
          file_url?: string | null
          group_id?: string | null
          id?: string
          location?: string | null
          name: string
          result_date?: string | null
          status?: string
          user_id: string
        }
        Update: {
          cancel_reason?: string | null
          consultation_id?: string | null
          created_at?: string
          exam_date?: string | null
          family_member_id?: string
          file_url?: string | null
          group_id?: string | null
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
          {
            foreignKeyName: "exams_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_group_members: {
        Row: {
          accepted_at: string | null
          auth_user_id: string
          family_member_id: string | null
          group_id: string
          id: string
          invited_at: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id: string
          family_member_id?: string | null
          group_id: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string
          family_member_id?: string | null
          group_id?: string
          id?: string
          invited_at?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "family_group_members_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      family_groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      family_members: {
        Row: {
          avatar_url: string | null
          birth_date: string | null
          blood_type: string | null
          breed: string | null
          cpf: string | null
          created_at: string
          deleted_at: string | null
          gender: string | null
          group_id: string | null
          height: number | null
          id: string
          member_type: string | null
          name: string
          phone: string | null
          physical_activity: string | null
          relationship: string
          species: string | null
          tracks_menstrual_cycle: boolean
          user_id: string
          weight: number | null
        }
        Insert: {
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          breed?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          group_id?: string | null
          height?: number | null
          id?: string
          member_type?: string | null
          name: string
          phone?: string | null
          physical_activity?: string | null
          relationship: string
          species?: string | null
          tracks_menstrual_cycle?: boolean
          user_id: string
          weight?: number | null
        }
        Update: {
          avatar_url?: string | null
          birth_date?: string | null
          blood_type?: string | null
          breed?: string | null
          cpf?: string | null
          created_at?: string
          deleted_at?: string | null
          gender?: string | null
          group_id?: string | null
          height?: number | null
          id?: string
          member_type?: string | null
          name?: string
          phone?: string | null
          physical_activity?: string | null
          relationship?: string
          species?: string | null
          tracks_menstrual_cycle?: boolean
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "family_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          family_member_id: string | null
          group_id: string
          id: string
          invited_by: string
          role: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          family_member_id?: string | null
          group_id: string
          id?: string
          invited_by: string
          role?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          family_member_id?: string | null
          group_id?: string
          id?: string
          invited_by?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      health_measurements: {
        Row: {
          bmi: number | null
          created_at: string
          family_member_id: string
          group_id: string | null
          height: number | null
          id: string
          recorded_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          bmi?: number | null
          created_at?: string
          family_member_id: string
          group_id?: string | null
          height?: number | null
          id?: string
          recorded_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          bmi?: number | null
          created_at?: string
          family_member_id?: string
          group_id?: string | null
          height?: number | null
          id?: string
          recorded_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "health_measurements_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "health_measurements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          consultation_id: string | null
          created_at: string
          dosage: string | null
          duration: string | null
          duration_days: number | null
          end_date: string | null
          estoque_minimo: number | null
          estoque_total: number | null
          family_member_id: string
          frequency: string | null
          frequency_hours: number | null
          group_id: string | null
          id: string
          last_stock_decrement: string | null
          medico_prescritor: string | null
          name: string
          receita_url: string | null
          start_date: string | null
          start_time: string | null
          status: string
          user_id: string
          uso_continuo: boolean
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          estoque_minimo?: number | null
          estoque_total?: number | null
          family_member_id: string
          frequency?: string | null
          frequency_hours?: number | null
          group_id?: string | null
          id?: string
          last_stock_decrement?: string | null
          medico_prescritor?: string | null
          name: string
          receita_url?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          user_id: string
          uso_continuo?: boolean
        }
        Update: {
          consultation_id?: string | null
          created_at?: string
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          estoque_minimo?: number | null
          estoque_total?: number | null
          family_member_id?: string
          frequency?: string | null
          frequency_hours?: number | null
          group_id?: string | null
          id?: string
          last_stock_decrement?: string | null
          medico_prescritor?: string | null
          name?: string
          receita_url?: string | null
          start_date?: string | null
          start_time?: string | null
          status?: string
          user_id?: string
          uso_continuo?: boolean
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
          {
            foreignKeyName: "medications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      menstrual_cycles: {
        Row: {
          alert_advance_days: number
          created_at: string
          cycle_length: number
          end_date: string | null
          familiar_id: string
          flow_intensity: string | null
          group_id: string | null
          id: string
          notes: string | null
          start_date: string
          symptoms: string | null
          user_id: string
        }
        Insert: {
          alert_advance_days?: number
          created_at?: string
          cycle_length?: number
          end_date?: string | null
          familiar_id: string
          flow_intensity?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          start_date: string
          symptoms?: string | null
          user_id: string
        }
        Update: {
          alert_advance_days?: number
          created_at?: string
          cycle_length?: number
          end_date?: string | null
          familiar_id?: string
          flow_intensity?: string | null
          group_id?: string | null
          id?: string
          notes?: string | null
          start_date?: string
          symptoms?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menstrual_cycles_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string | null
          family_member_id: string | null
          group_id: string | null
          id: string
          is_read: boolean | null
          medication_id: string | null
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
          group_id?: string | null
          id?: string
          is_read?: boolean | null
          medication_id?: string | null
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
          group_id?: string | null
          id?: string
          is_read?: boolean | null
          medication_id?: string | null
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
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
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
          group_id: string | null
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
          group_id?: string | null
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
          group_id?: string | null
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
          {
            foreignKeyName: "vaccines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "family_groups"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_stock: {
        Args: { amount?: number; med_id: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
