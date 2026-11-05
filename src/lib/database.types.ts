export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      ai_usage: {
        Row: {
          created_at: string
          id: string
          input_tokens: number | null
          kind: string
          output_tokens: number | null
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind: string
          output_tokens?: number | null
          owner_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_tokens?: number | null
          kind?: string
          output_tokens?: number | null
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      characters: {
        Row: {
          created_at: string
          data: Json
          id: string
          name: string | null
          owner_id: string
          player_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id?: string
          name?: string | null
          owner_id?: string
          player_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          name?: string | null
          owner_id?: string
          player_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "characters_player_fkey"
            columns: ["player_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id", "owner_id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          owner_id: string
          state: Json
          story_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          owner_id?: string
          state?: Json
          story_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          owner_id?: string
          state?: Json
          story_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "games_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          is_admin: boolean
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          is_admin?: boolean
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          is_admin?: boolean
        }
        Relationships: []
      }
      stories: {
        Row: {
          content: Json
          copied_from: string | null
          created_at: string
          id: string
          lang: string | null
          owner_id: string | null
          pack_files: string[]
          published_at: string | null
          summary: string | null
          title: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["story_visibility"]
        }
        Insert: {
          content: Json
          copied_from?: string | null
          created_at?: string
          id?: string
          lang?: string | null
          owner_id?: string | null
          pack_files?: string[]
          published_at?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["story_visibility"]
        }
        Update: {
          content?: Json
          copied_from?: string | null
          created_at?: string
          id?: string
          lang?: string | null
          owner_id?: string | null
          pack_files?: string[]
          published_at?: string | null
          summary?: string | null
          title?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["story_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "stories_copied_from_fkey"
            columns: ["copied_from"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_creations: {
        Row: {
          brief: Json
          created_at: string
          draft: Json | null
          error: string | null
          finished_at: string | null
          id: string
          input_tokens: number
          outline: Json | null
          outline_count: number
          output_tokens: number
          owner_id: string
          status: string
          story_id: string | null
          updated_at: string
        }
        Insert: {
          brief: Json
          created_at?: string
          draft?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number
          outline?: Json | null
          outline_count?: number
          output_tokens?: number
          owner_id: string
          status?: string
          story_id?: string | null
          updated_at?: string
        }
        Update: {
          brief?: Json
          created_at?: string
          draft?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number
          outline?: Json | null
          outline_count?: number
          output_tokens?: number
          owner_id?: string
          status?: string
          story_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_creations_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_creations_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_imports: {
        Row: {
          created_at: string
          draft: Json | null
          error: string | null
          finished_at: string | null
          id: string
          input_tokens: number | null
          output_tokens: number | null
          owner_id: string
          page_count: number
          status: Database["public"]["Enums"]["import_status"]
          story_id: string | null
        }
        Insert: {
          created_at?: string
          draft?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          owner_id: string
          page_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          story_id?: string | null
        }
        Update: {
          created_at?: string
          draft?: Json | null
          error?: string | null
          finished_at?: string | null
          id?: string
          input_tokens?: number | null
          output_tokens?: number | null
          owner_id?: string
          page_count?: number
          status?: Database["public"]["Enums"]["import_status"]
          story_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "story_imports_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_imports_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
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
      import_status: "running" | "succeeded" | "failed"
      story_visibility: "private" | "marketplace"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      import_status: ["running", "succeeded", "failed"],
      story_visibility: ["private", "marketplace"],
    },
  },
} as const

