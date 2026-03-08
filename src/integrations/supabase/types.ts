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
      assets: {
        Row: {
          categoria: Database["public"]["Enums"]["asset_category"]
          costo_adquisicion: number
          created_at: string
          descripcion: string
          estatus: Database["public"]["Enums"]["asset_status"]
          fecha_compra: string
          id: string
          nombre: string
          notas: string | null
          tipo: Database["public"]["Enums"]["asset_type"]
          updated_at: string
          user_id: string | null
          valor_rescate: number
          vida_util_meses: number
        }
        Insert: {
          categoria?: Database["public"]["Enums"]["asset_category"]
          costo_adquisicion?: number
          created_at?: string
          descripcion?: string
          estatus?: Database["public"]["Enums"]["asset_status"]
          fecha_compra?: string
          id?: string
          nombre: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string | null
          valor_rescate?: number
          vida_util_meses?: number
        }
        Update: {
          categoria?: Database["public"]["Enums"]["asset_category"]
          costo_adquisicion?: number
          created_at?: string
          descripcion?: string
          estatus?: Database["public"]["Enums"]["asset_status"]
          fecha_compra?: string
          id?: string
          nombre?: string
          notas?: string | null
          tipo?: Database["public"]["Enums"]["asset_type"]
          updated_at?: string
          user_id?: string | null
          valor_rescate?: number
          vida_util_meses?: number
        }
        Relationships: []
      }
      operating_expenses: {
        Row: {
          area: Database["public"]["Enums"]["expense_area"]
          categoria: Database["public"]["Enums"]["expense_category"]
          created_at: string
          descripcion: string
          fecha: string
          id: string
          monto: number
          notas: string | null
          subcategoria: string
          tipo: Database["public"]["Enums"]["expense_type"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          area?: Database["public"]["Enums"]["expense_area"]
          categoria: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          descripcion: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          subcategoria: string
          tipo?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          area?: Database["public"]["Enums"]["expense_area"]
          categoria?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          descripcion?: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          subcategoria?: string
          tipo?: Database["public"]["Enums"]["expense_type"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "director"
        | "administracion"
        | "gerencia_comercial"
        | "compras"
        | "vendedor"
        | "almacen"
        | "tecnico"
      asset_category:
        | "vehiculos"
        | "maquinaria"
        | "computadoras"
        | "software"
        | "mobiliario"
        | "equipo_oficina"
        | "otros"
      asset_status: "activo" | "dado_de_baja"
      asset_type: "depreciacion" | "amortizacion"
      expense_area:
        | "ventas"
        | "administracion"
        | "logistica"
        | "operaciones"
        | "direccion"
        | "servicio_tecnico"
        | "importaciones"
      expense_category:
        | "personal"
        | "administracion"
        | "ventas"
        | "logistica"
        | "importaciones"
        | "financieros"
        | "servicio_tecnico"
        | "legales_contables"
        | "otros"
      expense_type: "fijo" | "variable"
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
      app_role: [
        "director",
        "administracion",
        "gerencia_comercial",
        "compras",
        "vendedor",
        "almacen",
        "tecnico",
      ],
      asset_category: [
        "vehiculos",
        "maquinaria",
        "computadoras",
        "software",
        "mobiliario",
        "equipo_oficina",
        "otros",
      ],
      asset_status: ["activo", "dado_de_baja"],
      asset_type: ["depreciacion", "amortizacion"],
      expense_area: [
        "ventas",
        "administracion",
        "logistica",
        "operaciones",
        "direccion",
        "servicio_tecnico",
        "importaciones",
      ],
      expense_category: [
        "personal",
        "administracion",
        "ventas",
        "logistica",
        "importaciones",
        "financieros",
        "servicio_tecnico",
        "legales_contables",
        "otros",
      ],
      expense_type: ["fijo", "variable"],
    },
  },
} as const
