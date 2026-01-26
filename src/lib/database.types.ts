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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      beers: {
        Row: {
          brewer: string | null
          created_at: string | null
          event_id: string | null
          id: string
          name: string
          style: string | null
        }
        Insert: {
          brewer?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          name: string
          style?: string | null
        }
        Update: {
          brewer?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          name?: string
          style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beers_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      brewer_tokens: {
        Row: {
          beer_id: string | null
          created_at: string | null
          id: string
        }
        Insert: {
          beer_id?: string | null
          created_at?: string | null
          id?: string
        }
        Update: {
          beer_id?: string | null
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brewer_tokens_beer_id_fkey"
            columns: ["beer_id"]
            isOneToOne: true
            referencedRelation: "beers"
            referencedColumns: ["id"]
          },
        ]
      }
      event_admins: {
        Row: {
          admin_id: string
          created_at: string | null
          event_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string | null
          event_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string | null
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_admins_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "admins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_admins_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          blind_tasting: boolean | null
          created_at: string | null
          date: string | null
          id: string
          logo_url: string | null
          manage_token: string | null
          max_points: number | null
          name: string
          reveal_stage: number | null
        }
        Insert: {
          blind_tasting?: boolean | null
          created_at?: string | null
          date?: string | null
          id?: string
          logo_url?: string | null
          manage_token?: string | null
          max_points?: number | null
          name: string
          reveal_stage?: number | null
        }
        Update: {
          blind_tasting?: boolean | null
          created_at?: string | null
          date?: string | null
          id?: string
          logo_url?: string | null
          manage_token?: string | null
          max_points?: number | null
          name?: string
          reveal_stage?: number | null
        }
        Relationships: []
      }
      feedback: {
        Row: {
          beer_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          share_with_brewer: boolean | null
          voter_id: string | null
        }
        Insert: {
          beer_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          share_with_brewer?: boolean | null
          voter_id?: string | null
        }
        Update: {
          beer_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          share_with_brewer?: boolean | null
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_beer_id_fkey"
            columns: ["beer_id"]
            isOneToOne: false
            referencedRelation: "beers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "voters"
            referencedColumns: ["id"]
          },
        ]
      }
      short_codes: {
        Row: {
          code: string
          created_at: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          code: string
          created_at?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          code?: string
          created_at?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      voters: {
        Row: {
          created_at: string | null
          event_id: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          event_id?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voters_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      votes: {
        Row: {
          beer_id: string | null
          id: string
          points: number | null
          updated_at: string | null
          voter_id: string | null
        }
        Insert: {
          beer_id?: string | null
          id?: string
          points?: number | null
          updated_at?: string | null
          voter_id?: string | null
        }
        Update: {
          beer_id?: string | null
          id?: string
          points?: number | null
          updated_at?: string | null
          voter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "votes_beer_id_fkey"
            columns: ["beer_id"]
            isOneToOne: false
            referencedRelation: "beers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "votes_voter_id_fkey"
            columns: ["voter_id"]
            isOneToOne: false
            referencedRelation: "voters"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
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
