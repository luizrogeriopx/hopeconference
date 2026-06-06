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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          atualizado_em: string
          id: boolean
          inscricoes_abertas: boolean
          mercado_pago_ativo: boolean
          mercado_pago_public_key: string
        }
        Insert: {
          atualizado_em?: string
          id?: boolean
          inscricoes_abertas?: boolean
          mercado_pago_ativo?: boolean
          mercado_pago_public_key?: string
        }
        Update: {
          atualizado_em?: string
          id?: boolean
          inscricoes_abertas?: boolean
          mercado_pago_ativo?: boolean
          mercado_pago_public_key?: string
        }
        Relationships: []
      }
      app_secrets: {
        Row: {
          atualizado_em: string
          id: boolean
          mercado_pago_access_token: string
        }
        Insert: {
          atualizado_em?: string
          id?: boolean
          mercado_pago_access_token?: string
        }
        Update: {
          atualizado_em?: string
          id?: boolean
          mercado_pago_access_token?: string
        }
        Relationships: []
      }
      inscricoes: {
        Row: {
          comprador_user_id: string
          criado_em: string
          email: string | null
          id: string
          nome_participante: string
          qr_token: string
          status: Database["public"]["Enums"]["inscricao_status"]
          telefone: string | null
          validado_em: string | null
          validado_por: string | null
          valor: number
        }
        Insert: {
          comprador_user_id: string
          criado_em?: string
          email?: string | null
          id?: string
          nome_participante: string
          qr_token?: string
          status?: Database["public"]["Enums"]["inscricao_status"]
          telefone?: string | null
          validado_em?: string | null
          validado_por?: string | null
          valor?: number
        }
        Update: {
          comprador_user_id?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome_participante?: string
          qr_token?: string
          status?: Database["public"]["Enums"]["inscricao_status"]
          telefone?: string | null
          validado_em?: string | null
          validado_por?: string | null
          valor?: number
        }
        Relationships: []
      }
      pagamentos: {
        Row: {
          criado_em: string
          id: string
          inscricao_id: string
          metodo: string
          status: string
          valor: number
          preference_id: string | null
          payment_id: string | null
          payment_url: string | null
          pix_qr_base64: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          inscricao_id: string
          metodo?: string
          status?: string
          valor: number
          preference_id?: string | null
          payment_id?: string | null
          payment_url?: string | null
          pix_qr_base64?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          inscricao_id?: string
          metodo?: string
          status?: string
          valor?: number
          preference_id?: string | null
          payment_id?: string | null
          payment_url?: string | null
          pix_qr_base64?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          criado_em: string
          email: string
          id: string
          nome: string | null
        }
        Insert: {
          criado_em?: string
          email: string
          id: string
          nome?: string | null
        }
        Update: {
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "gate" | "inscrito"
      inscricao_status: "pendente" | "pago" | "cancelado" | "validado"
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
      app_role: ["super_admin", "admin", "gate", "inscrito"],
      inscricao_status: ["pendente", "pago", "cancelado", "validado"],
    },
  },
} as const
