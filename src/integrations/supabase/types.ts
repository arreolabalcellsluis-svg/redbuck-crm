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
      accounts_payable: {
        Row: {
          balance: number
          created_at: string
          currency: string
          description: string
          due_date: string
          id: string
          import_order_id: string | null
          invoice_date: string
          invoice_number: string
          notes: string | null
          paid: number
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          purchase_order_id: string | null
          status: Database["public"]["Enums"]["payable_status"]
          supplier_name: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          description?: string
          due_date?: string
          id?: string
          import_order_id?: string | null
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_name: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          description?: string
          due_date?: string
          id?: string
          import_order_id?: string | null
          invoice_date?: string
          invoice_number?: string
          notes?: string | null
          paid?: number
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          purchase_order_id?: string | null
          status?: Database["public"]["Enums"]["payable_status"]
          supplier_name?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
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
      customers: {
        Row: {
          city: string
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string
          priority: Database["public"]["Enums"]["customer_priority"]
          rfc: string | null
          source: Database["public"]["Enums"]["lead_source"]
          state: string
          trade_name: string | null
          type: Database["public"]["Enums"]["customer_type"]
          updated_at: string
          user_id: string | null
          vendor_id: string | null
          whatsapp: string | null
        }
        Insert: {
          city?: string
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string
          priority?: Database["public"]["Enums"]["customer_priority"]
          rfc?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          state?: string
          trade_name?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          city?: string
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string
          priority?: Database["public"]["Enums"]["customer_priority"]
          rfc?: string | null
          source?: Database["public"]["Enums"]["lead_source"]
          state?: string
          trade_name?: string | null
          type?: Database["public"]["Enums"]["customer_type"]
          updated_at?: string
          user_id?: string | null
          vendor_id?: string | null
          whatsapp?: string | null
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
      orders: {
        Row: {
          advance: number
          balance: number
          created_at: string
          customer_id: string | null
          customer_name: string
          delivery_notes: string | null
          folio: string
          id: string
          items: Json
          order_type: Database["public"]["Enums"]["order_type"]
          promise_date: string | null
          quotation_folio: string | null
          reserve_deadline: string | null
          scheduled_delivery_date: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          updated_at: string
          user_id: string | null
          vendor_name: string
          warehouse: string
        }
        Insert: {
          advance?: number
          balance?: number
          created_at?: string
          customer_id?: string | null
          customer_name: string
          delivery_notes?: string | null
          folio: string
          id?: string
          items?: Json
          order_type?: Database["public"]["Enums"]["order_type"]
          promise_date?: string | null
          quotation_folio?: string | null
          reserve_deadline?: string | null
          scheduled_delivery_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
          vendor_name?: string
          warehouse?: string
        }
        Update: {
          advance?: number
          balance?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          delivery_notes?: string | null
          folio?: string
          id?: string
          items?: Json
          order_type?: Database["public"]["Enums"]["order_type"]
          promise_date?: string | null
          quotation_folio?: string | null
          reserve_deadline?: string | null
          scheduled_delivery_date?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          updated_at?: string
          user_id?: string | null
          vendor_name?: string
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          brand: string
          category: Database["public"]["Enums"]["product_category"]
          cost: number
          created_at: string
          currency: Database["public"]["Enums"]["product_currency"]
          delivery_days: number
          description: string
          id: string
          image: string | null
          in_transit: number
          list_price: number
          min_price: number
          model: string
          name: string
          sku: string
          stock: Json
          supplier: string
          updated_at: string
          user_id: string | null
          warranty: string
        }
        Insert: {
          active?: boolean
          brand?: string
          category?: Database["public"]["Enums"]["product_category"]
          cost?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["product_currency"]
          delivery_days?: number
          description?: string
          id?: string
          image?: string | null
          in_transit?: number
          list_price?: number
          min_price?: number
          model?: string
          name: string
          sku: string
          stock?: Json
          supplier?: string
          updated_at?: string
          user_id?: string | null
          warranty?: string
        }
        Update: {
          active?: boolean
          brand?: string
          category?: Database["public"]["Enums"]["product_category"]
          cost?: number
          created_at?: string
          currency?: Database["public"]["Enums"]["product_currency"]
          delivery_days?: number
          description?: string
          id?: string
          image?: string | null
          in_transit?: number
          list_price?: number
          min_price?: number
          model?: string
          name?: string
          sku?: string
          stock?: Json
          supplier?: string
          updated_at?: string
          user_id?: string | null
          warranty?: string
        }
        Relationships: []
      }
      quotations: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string
          customer_phone: string | null
          customer_whatsapp: string | null
          folio: string
          id: string
          items: Json
          status: Database["public"]["Enums"]["quotation_status"]
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string | null
          valid_until: string
          vendor_email: string | null
          vendor_id: string | null
          vendor_name: string
          vendor_phone: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          folio: string
          id?: string
          items?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string
          vendor_email?: string | null
          vendor_id?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_whatsapp?: string | null
          folio?: string
          id?: string
          items?: Json
          status?: Database["public"]["Enums"]["quotation_status"]
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          valid_until?: string
          vendor_email?: string | null
          vendor_id?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_goals: {
        Row: {
          created_at: string
          goal_followups: number
          goal_new_customers: number
          goal_orders: number
          goal_quotations: number
          goal_sales: number
          id: string
          month: number
          updated_at: string
          user_id: string | null
          vendor_id: string
          vendor_name: string
          year: number
        }
        Insert: {
          created_at?: string
          goal_followups?: number
          goal_new_customers?: number
          goal_orders?: number
          goal_quotations?: number
          goal_sales?: number
          id?: string
          month: number
          updated_at?: string
          user_id?: string | null
          vendor_id: string
          vendor_name?: string
          year: number
        }
        Update: {
          created_at?: string
          goal_followups?: number
          goal_new_customers?: number
          goal_orders?: number
          goal_quotations?: number
          goal_sales?: number
          id?: string
          month?: number
          updated_at?: string
          user_id?: string | null
          vendor_id?: string
          vendor_name?: string
          year?: number
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
      customer_priority: "alta" | "media" | "baja"
      customer_type:
        | "taller_mecanico"
        | "llantera"
        | "suspension_frenos"
        | "agencia"
        | "flotilla"
        | "transportista"
        | "vulcanizadora"
        | "particular"
        | "distribuidor"
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
      lead_source:
        | "facebook"
        | "whatsapp"
        | "llamada"
        | "recomendacion"
        | "sitio_web"
        | "visita_sucursal"
        | "expos"
        | "campaña"
        | "organico"
        | "otro"
      order_status:
        | "nuevo"
        | "por_confirmar"
        | "confirmado"
        | "confirmado_anticipo"
        | "apartado"
        | "entrega_programada"
        | "en_bodega"
        | "surtido_parcial"
        | "surtido_total"
        | "en_reparto"
        | "en_entrega"
        | "entregado"
        | "cancelado"
      order_type: "directo" | "anticipo" | "apartado" | "entrega_futura"
      payable_status:
        | "pendiente"
        | "por_vencer"
        | "vencida"
        | "pago_parcial"
        | "liquidada"
        | "cancelada"
      payment_method:
        | "transferencia"
        | "cheque"
        | "efectivo"
        | "tarjeta"
        | "compensacion"
        | "otro"
      product_category:
        | "elevadores"
        | "balanceadoras"
        | "desmontadoras"
        | "alineadoras"
        | "hidraulico"
        | "lubricacion"
        | "aire"
        | "otros"
      product_currency: "MXN" | "USD"
      quotation_status:
        | "borrador"
        | "enviada"
        | "vista"
        | "seguimiento"
        | "aceptada"
        | "rechazada"
        | "vencida"
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
      customer_priority: ["alta", "media", "baja"],
      customer_type: [
        "taller_mecanico",
        "llantera",
        "suspension_frenos",
        "agencia",
        "flotilla",
        "transportista",
        "vulcanizadora",
        "particular",
        "distribuidor",
      ],
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
      lead_source: [
        "facebook",
        "whatsapp",
        "llamada",
        "recomendacion",
        "sitio_web",
        "visita_sucursal",
        "expos",
        "campaña",
        "organico",
        "otro",
      ],
      order_status: [
        "nuevo",
        "por_confirmar",
        "confirmado",
        "confirmado_anticipo",
        "apartado",
        "entrega_programada",
        "en_bodega",
        "surtido_parcial",
        "surtido_total",
        "en_reparto",
        "en_entrega",
        "entregado",
        "cancelado",
      ],
      order_type: ["directo", "anticipo", "apartado", "entrega_futura"],
      payable_status: [
        "pendiente",
        "por_vencer",
        "vencida",
        "pago_parcial",
        "liquidada",
        "cancelada",
      ],
      payment_method: [
        "transferencia",
        "cheque",
        "efectivo",
        "tarjeta",
        "compensacion",
        "otro",
      ],
      product_category: [
        "elevadores",
        "balanceadoras",
        "desmontadoras",
        "alineadoras",
        "hidraulico",
        "lubricacion",
        "aire",
        "otros",
      ],
      product_currency: ["MXN", "USD"],
      quotation_status: [
        "borrador",
        "enviada",
        "vista",
        "seguimiento",
        "aceptada",
        "rechazada",
        "vencida",
      ],
    },
  },
} as const
