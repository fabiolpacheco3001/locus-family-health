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
      admin_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          metadata: Json | null
          performed_by: string
          target_email: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by: string
          target_email?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          performed_by?: string
          target_email?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          feature: string
          id: string
          tokens_used: number
          user_id: string
        }
        Insert: {
          created_at?: string
          feature: string
          id?: string
          tokens_used?: number
          user_id: string
        }
        Update: {
          created_at?: string
          feature?: string
          id?: string
          tokens_used?: number
          user_id?: string
        }
        Relationships: []
      }
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
          {
            foreignKeyName: "fk_blood_pressure_history_family_member"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      changelogs: {
        Row: {
          created_at: string
          created_by: string
          description: string
          id: string
          release_date: string
          title: string
          type: string
          version: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description: string
          id?: string
          release_date?: string
          title: string
          type?: string
          version: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          release_date?: string
          title?: string
          type?: string
          version?: string
        }
        Relationships: []
      }
      consent_log: {
        Row: {
          consent_type: string
          granted_at: string
          id: string
          policy_version: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          granted_at?: string
          id?: string
          policy_version?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          granted_at?: string
          id?: string
          policy_version?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      consultations: {
        Row: {
          cancel_reason: string | null
          consultation_date: string | null
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      cron_job_log: {
        Row: {
          detail: string | null
          id: number
          job_name: string
          ran_at: string
          rows_affected: number | null
          status: string
        }
        Insert: {
          detail?: string | null
          id?: number
          job_name: string
          ran_at?: string
          rows_affected?: number | null
          status: string
        }
        Update: {
          detail?: string | null
          id?: number
          job_name?: string
          ran_at?: string
          rows_affected?: number | null
          status?: string
        }
        Relationships: []
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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string | null
          recipient_email_hash: string | null
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_email_hash?: string | null
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string | null
          recipient_email_hash?: string | null
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          queue_name: string
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          queue_name?: string
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          queue_name?: string
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      exams: {
        Row: {
          cancel_reason: string | null
          consultation_id: string | null
          created_at: string
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          managed_profiles: string[] | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          accepted_at?: string | null
          auth_user_id: string
          family_member_id?: string | null
          group_id: string
          id?: string
          invited_at?: string
          managed_profiles?: string[] | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          accepted_at?: string | null
          auth_user_id?: string
          family_member_id?: string | null
          group_id?: string
          id?: string
          invited_at?: string
          managed_profiles?: string[] | null
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
          address_number: string | null
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
          postal_code: string | null
          relationship: string
          species: string | null
          tracks_menstrual_cycle: boolean
          user_id: string
          weight: number | null
        }
        Insert: {
          address_number?: string | null
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
          postal_code?: string | null
          relationship: string
          species?: string | null
          tracks_menstrual_cycle?: boolean
          user_id: string
          weight?: number | null
        }
        Update: {
          address_number?: string | null
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
          postal_code?: string | null
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
      medication_doses: {
        Row: {
          created_at: string
          id: string
          medication_id: string
          scheduled_for: string
          status: string
          taken_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          medication_id: string
          scheduled_for: string
          status?: string
          taken_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          medication_id?: string
          scheduled_for?: string
          status?: string
          taken_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "medication_doses_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "medications"
            referencedColumns: ["id"]
          },
        ]
      }
      medications: {
        Row: {
          consultation_id: string | null
          created_at: string
          deleted_at: string | null
          dosage: string | null
          duration: string | null
          duration_days: number | null
          end_date: string | null
          estoque_minimo: number | null
          estoque_total: number | null
          family_member_id: string
          frequency: string | null
          frequency_hours: number | null
          frequency_type: string
          group_id: string | null
          id: string
          last_stock_decrement: string | null
          medico_prescritor: string | null
          name: string
          reason: string | null
          receita_url: string | null
          specific_days: Json
          specific_times: Json
          start_date: string | null
          start_time: string | null
          status: string
          user_id: string
          uso_continuo: boolean
        }
        Insert: {
          consultation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          estoque_minimo?: number | null
          estoque_total?: number | null
          family_member_id: string
          frequency?: string | null
          frequency_hours?: number | null
          frequency_type?: string
          group_id?: string | null
          id?: string
          last_stock_decrement?: string | null
          medico_prescritor?: string | null
          name: string
          reason?: string | null
          receita_url?: string | null
          specific_days?: Json
          specific_times?: Json
          start_date?: string | null
          start_time?: string | null
          status?: string
          user_id: string
          uso_continuo?: boolean
        }
        Update: {
          consultation_id?: string | null
          created_at?: string
          deleted_at?: string | null
          dosage?: string | null
          duration?: string | null
          duration_days?: number | null
          end_date?: string | null
          estoque_minimo?: number | null
          estoque_total?: number | null
          family_member_id?: string
          frequency?: string | null
          frequency_hours?: number | null
          frequency_type?: string
          group_id?: string | null
          id?: string
          last_stock_decrement?: string | null
          medico_prescritor?: string | null
          name?: string
          reason?: string | null
          receita_url?: string | null
          specific_days?: Json
          specific_times?: Json
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
            foreignKeyName: "fk_menstrual_cycles_family_member"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
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
      passkeys: {
        Row: {
          aaguid: string | null
          counter: number
          created_at: string
          credential_id: string
          device_name: string
          id: string
          last_used_at: string | null
          public_key: string
          transports: string[] | null
          user_id: string
        }
        Insert: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key: string
          transports?: string[] | null
          user_id: string
        }
        Update: {
          aaguid?: string | null
          counter?: number
          created_at?: string
          credential_id?: string
          device_name?: string
          id?: string
          last_used_at?: string | null
          public_key?: string
          transports?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      pet_routines: {
        Row: {
          created_at: string
          date_performed: string
          family_member_id: string
          id: string
          next_due_date: string | null
          notes: string | null
          recurrence: string | null
          routine_type: string
          status: string
          time_performed: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          date_performed: string
          family_member_id: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recurrence?: string | null
          routine_type: string
          status?: string
          time_performed?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          date_performed?: string
          family_member_id?: string
          id?: string
          next_due_date?: string | null
          notes?: string | null
          recurrence?: string | null
          routine_type?: string
          status?: string
          time_performed?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_routines_family_member_id_fkey"
            columns: ["family_member_id"]
            isOneToOne: false
            referencedRelation: "family_members"
            referencedColumns: ["id"]
          },
        ]
      }
      renewal_failures: {
        Row: {
          failed_at: string
          id: number
          next_retry_at: string
          reason: string | null
          resolved_at: string | null
          retry_count: number
          status: string
          subscription_id: string | null
          user_id: string
        }
        Insert: {
          failed_at?: string
          id?: number
          next_retry_at?: string
          reason?: string | null
          resolved_at?: string | null
          retry_count?: number
          status?: string
          subscription_id?: string | null
          user_id: string
        }
        Update: {
          failed_at?: string
          id?: number
          next_retry_at?: string
          reason?: string | null
          resolved_at?: string | null
          retry_count?: number
          status?: string
          subscription_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          asaas_customer_id: string | null
          asaas_payment_id: string | null
          asaas_subscription_id: string | null
          created_at: string
          credit_card_token: string | null
          id: string
          next_billing_date: string | null
          plan_type: string
          status: string
          test_mode: boolean
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          credit_card_token?: string | null
          id?: string
          next_billing_date?: string | null
          plan_type?: string
          status?: string
          test_mode?: boolean
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_payment_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string
          credit_card_token?: string | null
          id?: string
          next_billing_date?: string | null
          plan_type?: string
          status?: string
          test_mode?: boolean
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      system_configs: {
        Row: {
          description: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          description?: string
          id?: string
          key: string
          updated_at?: string
          value?: string
        }
        Update: {
          description?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      vaccines: {
        Row: {
          applied_date: string | null
          batch: string | null
          booster_date: string | null
          city: string | null
          created_at: string
          deleted_at: string | null
          details: string | null
          dose_type: string | null
          facility: string | null
          family_member_id: string
          group_id: string | null
          id: string
          name: string
          side_effects: string | null
          state: string | null
          user_id: string
        }
        Insert: {
          applied_date?: string | null
          batch?: string | null
          booster_date?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string | null
          dose_type?: string | null
          facility?: string | null
          family_member_id: string
          group_id?: string | null
          id?: string
          name: string
          side_effects?: string | null
          state?: string | null
          user_id: string
        }
        Update: {
          applied_date?: string | null
          batch?: string | null
          booster_date?: string | null
          city?: string | null
          created_at?: string
          deleted_at?: string | null
          details?: string | null
          dose_type?: string | null
          facility?: string | null
          family_member_id?: string
          group_id?: string | null
          id?: string
          name?: string
          side_effects?: string | null
          state?: string | null
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
      webauthn_challenges: {
        Row: {
          challenge: string
          expires_at: string
          id: string
          type: string
          user_id: string
        }
        Insert: {
          challenge: string
          expires_at?: string
          id?: string
          type: string
          user_id: string
        }
        Update: {
          challenge?: string
          expires_at?: string
          id?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_group_access: { Args: { _group_id: string }; Returns: boolean }
      decrement_stock: {
        Args: { amount?: number; med_id: string }
        Returns: number
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_admin_clients: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          next_billing_date: string
          plan_type: string
          status: string
          test_mode: boolean
          user_id: string
        }[]
      }
      get_owner_subscription_safe: {
        Args: { _owner_id: string }
        Returns: {
          asaas_payment_id: string
          asaas_subscription_id: string
          created_at: string
          id: string
          next_billing_date: string
          plan_type: string
          status: string
          test_mode: boolean
          trial_end: string
          updated_at: string
          user_id: string
        }[]
      }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      set_user_test_mode: {
        Args: { enabled: boolean; target_user_id: string }
        Returns: boolean
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
