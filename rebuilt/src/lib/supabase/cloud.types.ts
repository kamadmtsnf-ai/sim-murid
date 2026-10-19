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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      academic_years: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_active: boolean
          start_year: number
          starts_on: string | null
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          start_year: number
          starts_on?: string | null
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_active?: boolean
          start_year?: number
          starts_on?: string | null
        }
        Relationships: []
      }
      assignment_catalog: {
        Row: {
          code: string
          description: string
          legacy_label: string
        }
        Insert: {
          code: string
          description?: string
          legacy_label: string
        }
        Update: {
          code?: string
          description?: string
          legacy_label?: string
        }
        Relationships: []
      }
      business_policies: {
        Row: {
          approval_source: string
          approved_on: string
          configuration: Json
          created_at: string
          id: string
          policy_type: string
          version: string
        }
        Insert: {
          approval_source: string
          approved_on: string
          configuration: Json
          created_at?: string
          id?: string
          policy_type: string
          version: string
        }
        Update: {
          approval_source?: string
          approved_on?: string
          configuration?: Json
          created_at?: string
          id?: string
          policy_type?: string
          version?: string
        }
        Relationships: []
      }
      classes: {
        Row: {
          academic_year_id: string
          archived_at: string | null
          created_at: string
          homeroom_teacher_id: string | null
          id: string
          level: number
          name: string
          updated_at: string
        }
        Insert: {
          academic_year_id: string
          archived_at?: string | null
          created_at?: string
          homeroom_teacher_id?: string | null
          id?: string
          level: number
          name: string
          updated_at?: string
        }
        Update: {
          academic_year_id?: string
          archived_at?: string | null
          created_at?: string
          homeroom_teacher_id?: string | null
          id?: string
          level?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "classes_academic_year_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_homeroom_teacher_id_fkey"
            columns: ["homeroom_teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          holiday_date: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          holiday_date: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          holiday_date?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "holidays_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memorization_catalog: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          bio: string
          contact_email: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
          status: string
          updated_at: string
          username: string
        }
        Insert: {
          bio?: string
          contact_email?: string | null
          created_at?: string
          full_name: string
          id: string
          phone?: string | null
          status?: string
          updated_at?: string
          username: string
        }
        Update: {
          bio?: string
          contact_email?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          status?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      role_catalog: {
        Row: {
          code: string
          description: string
          legacy_label: string
        }
        Insert: {
          code: string
          description?: string
          legacy_label: string
        }
        Update: {
          code?: string
          description?: string
          legacy_label?: string
        }
        Relationships: []
      }
      school_profile: {
        Row: {
          address_data: Json
          asset_data: Json
          created_at: string
          id: string
          identity_data: Json
          name: string
          singleton_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_data?: Json
          asset_data?: Json
          created_at?: string
          id?: string
          identity_data?: Json
          name: string
          singleton_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_data?: Json
          asset_data?: Json
          created_at?: string
          id?: string
          identity_data?: Json
          name?: string
          singleton_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_profile_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      semesters: {
        Row: {
          academic_year_id: string
          ends_on: string | null
          id: string
          number: number
          starts_on: string | null
          year_start: number
        }
        Insert: {
          academic_year_id: string
          ends_on?: string | null
          id?: string
          number: number
          starts_on?: string | null
          year_start: number
        }
        Update: {
          academic_year_id?: string
          ends_on?: string | null
          id?: string
          number?: number
          starts_on?: string | null
          year_start?: number
        }
        Relationships: [
          {
            foreignKeyName: "semesters_academic_year_id_year_start_fkey"
            columns: ["academic_year_id", "year_start"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id", "start_year"]
          },
        ]
      }
      subjects: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_access_flags: {
        Row: {
          premium_access: boolean
          savings_access: boolean
          teacher_email_verified_at: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          premium_access?: boolean
          savings_access?: boolean
          teacher_email_verified_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          premium_access?: boolean
          savings_access?: boolean
          teacher_email_verified_at?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_access_flags_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_access_flags_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_assignments: {
        Row: {
          assigned_by: string | null
          assignment_code: string
          created_at: string
          id: string
          revoked_at: string | null
          scope_class_id: string | null
          user_id: string
          valid_from: string
          valid_until: string | null
        }
        Insert: {
          assigned_by?: string | null
          assignment_code: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          scope_class_id?: string | null
          user_id: string
          valid_from: string
          valid_until?: string | null
        }
        Update: {
          assigned_by?: string | null
          assignment_code?: string
          created_at?: string
          id?: string
          revoked_at?: string | null
          scope_class_id?: string | null
          user_id?: string
          valid_from?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assignments_assignment_code_fkey"
            columns: ["assignment_code"]
            isOneToOne: false
            referencedRelation: "assignment_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_assignments_scope_class_id_fkey"
            columns: ["scope_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string | null
          role_code: string
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by?: string | null
          role_code: string
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string | null
          role_code?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_role_code_fkey"
            columns: ["role_code"]
            isOneToOne: false
            referencedRelation: "role_catalog"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_access_check: {
        Args: { p_capability: string; p_class?: string; p_owner?: string }
        Returns: boolean
      }
      app_access_context: { Args: never; Returns: Json }
      app_auth_attempt: { Args: { p_key: string }; Returns: boolean }
      app_auth_claim: {
        Args: { p_remember: boolean; p_session: string; p_user: string }
        Returns: boolean
      }
      app_auth_device: {
        Args: { p_label: string; p_session: string; p_user: string }
        Returns: undefined
      }
      app_auth_principal: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      app_auth_revoke: {
        Args: { p_session: string; p_user: string }
        Returns: undefined
      }
      app_onboarding_ready: {
        Args: { p_session: string; p_user: string }
        Returns: boolean
      }
      app_password_begin: {
        Args: { p_operation: string; p_session: string; p_user: string }
        Returns: boolean
      }
      app_password_finish: {
        Args: { p_operation: string; p_user: string }
        Returns: boolean
      }
      app_profile_read: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      app_profile_update: {
        Args: {
          p_bio: string
          p_email: string
          p_name: string
          p_phone: string
          p_session: string
          p_user: string
          p_version: string
        }
        Returns: boolean
      }
      app_recovery_begin: {
        Args: {
          p_actor: string
          p_evidence: string
          p_operation: string
          p_reject?: boolean
          p_request: string
          p_session: string
        }
        Returns: Json
      }
      app_recovery_finish: {
        Args: {
          p_actor: string
          p_operation: string
          p_request: string
          p_session: string
        }
        Returns: boolean
      }
      app_recovery_identity: { Args: { p_username: string }; Returns: Json }
      app_recovery_list: {
        Args: { p_actor: string; p_session: string }
        Returns: Json
      }
      app_recovery_probe: { Args: { p_key: string }; Returns: boolean }
      app_recovery_request: {
        Args: { p_answer_verified: boolean; p_type: string; p_user: string }
        Returns: undefined
      }
      app_security_question_save: {
        Args: {
          p_hash: string
          p_question: string
          p_session: string
          p_user: string
        }
        Returns: boolean
      }
      app_security_rate: {
        Args: { p_session: string; p_user: string }
        Returns: boolean
      }
      app_security_state: {
        Args: { p_session: string; p_user: string }
        Returns: Json
      }
      app_session_list: {
        Args: { p_actor: string; p_auth_session: string; p_username?: string }
        Returns: Json
      }
      app_session_revoke: {
        Args: {
          p_actor: string
          p_auth_session: string
          p_session?: string
          p_username?: string
        }
        Returns: Json
      }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
