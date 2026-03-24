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
      accounts_receivable: {
        Row: {
          balance: number
          created_at: string
          customer_id: string | null
          customer_name: string
          days_overdue: number
          due_date: string
          id: string
          order_folio: string
          order_id: string
          paid: number
          status: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          balance?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          days_overdue?: number
          due_date?: string
          id?: string
          order_folio?: string
          order_id: string
          paid?: number
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          balance?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          days_overdue?: number
          due_date?: string
          id?: string
          order_folio?: string
          order_id?: string
          paid?: number
          status?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accounts_receivable_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounts_receivable_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          created_at: string
          customer_id: string | null
          customer_name: string | null
          date: string
          id: string
          lead_id: string | null
          lead_name: string | null
          notes: string
          priority: string
          product_id: string | null
          product_name: string | null
          quotation_folio: string | null
          quotation_id: string | null
          responsible_id: string
          responsible_name: string
          status: string
          time: string | null
          title: string
          type: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          notes?: string
          priority?: string
          product_id?: string | null
          product_name?: string | null
          quotation_folio?: string | null
          quotation_id?: string | null
          responsible_id?: string
          responsible_name?: string
          status?: string
          time?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          date?: string
          id?: string
          lead_id?: string | null
          lead_name?: string | null
          notes?: string
          priority?: string
          product_id?: string | null
          product_name?: string | null
          quotation_folio?: string | null
          quotation_id?: string | null
          responsible_id?: string
          responsible_name?: string
          status?: string
          time?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      area_goals: {
        Row: {
          area: string
          bonus_base: number
          bonus_overperformance_rate: number
          created_at: string
          id: string
          kpi_config: Json
          manual_kpi_values: Json
          month: number
          updated_at: string
          user_id: string | null
          user_name: string
          year: number
        }
        Insert: {
          area: string
          bonus_base?: number
          bonus_overperformance_rate?: number
          created_at?: string
          id?: string
          kpi_config?: Json
          manual_kpi_values?: Json
          month: number
          updated_at?: string
          user_id?: string | null
          user_name?: string
          year: number
        }
        Update: {
          area?: string
          bonus_base?: number
          bonus_overperformance_rate?: number
          created_at?: string
          id?: string
          kpi_config?: Json
          manual_kpi_values?: Json
          month?: number
          updated_at?: string
          user_id?: string | null
          user_name?: string
          year?: number
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
      bank_accounts: {
        Row: {
          activa: boolean
          banco: string
          clabe: string | null
          created_at: string
          id: string
          moneda: string
          nombre: string
          notas: string | null
          numero_cuenta: string
          saldo: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activa?: boolean
          banco?: string
          clabe?: string | null
          created_at?: string
          id?: string
          moneda?: string
          nombre: string
          notas?: string | null
          numero_cuenta?: string
          saldo?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activa?: boolean
          banco?: string
          clabe?: string | null
          created_at?: string
          id?: string
          moneda?: string
          nombre?: string
          notas?: string | null
          numero_cuenta?: string
          saldo?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      commercial_documents: {
        Row: {
          conditions: string | null
          created_at: string
          customer_contact: string
          customer_name: string
          doc_type: string
          folio: string
          id: string
          items: Json
          legal_text: string | null
          notes: string | null
          order_id: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
          user_id: string | null
          vendor_name: string
          vendor_phone: string | null
        }
        Insert: {
          conditions?: string | null
          created_at?: string
          customer_contact?: string
          customer_name?: string
          doc_type?: string
          folio: string
          id?: string
          items?: Json
          legal_text?: string | null
          notes?: string | null
          order_id: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Update: {
          conditions?: string | null
          created_at?: string
          customer_contact?: string
          customer_name?: string
          doc_type?: string
          folio?: string
          id?: string
          items?: Json
          legal_text?: string | null
          notes?: string | null
          order_id?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          vendor_name?: string
          vendor_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commercial_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_config: {
        Row: {
          config_key: string
          config_value: Json
          id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_fiscal_data: {
        Row: {
          cfdi_use_default: string
          created_at: string
          customer_id: string
          fiscal_zip_code: string
          id: string
          invoice_email: string | null
          legal_name: string
          rfc: string
          tax_regime: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cfdi_use_default?: string
          created_at?: string
          customer_id: string
          fiscal_zip_code?: string
          id?: string
          invoice_email?: string | null
          legal_name?: string
          rfc?: string
          tax_regime?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cfdi_use_default?: string
          created_at?: string
          customer_id?: string
          fiscal_zip_code?: string
          id?: string
          invoice_email?: string | null
          legal_name?: string
          rfc?: string
          tax_regime?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_fiscal_data_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          city: string
          contact_name: string | null
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
          contact_name?: string | null
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
          contact_name?: string | null
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
      equity_entries: {
        Row: {
          concepto: string
          created_at: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          monto: number
          notas: string | null
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          concepto?: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          monto?: number
          notas?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          concepto?: string
          created_at?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          monto?: number
          notas?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      fiscal_settings: {
        Row: {
          created_at: string
          csd_cer_path: string | null
          csd_expiration_date: string | null
          csd_key_path: string | null
          csd_password_encrypted: string | null
          csd_status: string | null
          default_series: string | null
          expedition_zip_code: string
          id: string
          issuer_name: string
          issuer_rfc: string
          issuer_tax_regime: string
          issuer_trade_name: string | null
          pac_api_url: string | null
          pac_provider: string
          pac_token_encrypted: string | null
          pac_username: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          csd_cer_path?: string | null
          csd_expiration_date?: string | null
          csd_key_path?: string | null
          csd_password_encrypted?: string | null
          csd_status?: string | null
          default_series?: string | null
          expedition_zip_code?: string
          id?: string
          issuer_name?: string
          issuer_rfc?: string
          issuer_tax_regime?: string
          issuer_trade_name?: string | null
          pac_api_url?: string | null
          pac_provider?: string
          pac_token_encrypted?: string | null
          pac_username?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          csd_cer_path?: string | null
          csd_expiration_date?: string | null
          csd_key_path?: string | null
          csd_password_encrypted?: string | null
          csd_status?: string | null
          default_series?: string | null
          expedition_zip_code?: string
          id?: string
          issuer_name?: string
          issuer_rfc?: string
          issuer_tax_regime?: string
          issuer_trade_name?: string | null
          pac_api_url?: string | null
          pac_provider?: string
          pac_token_encrypted?: string | null
          pac_username?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      import_orders: {
        Row: {
          arrival_port: string
          comercializadora: number
          country: string
          created_at: string
          currency: string
          customs_cost: number
          days_in_transit: number
          departure_port: string
          dta: number
          estimated_arrival: string | null
          estimated_departure: string | null
          exchange_rate: number
          flete_internacional_maritimo: number
          flete_local_china: number
          flete_terrestre_gdl: number
          freight_cost: number
          gastos_locales_naviera: number
          honorarios_despacho_aduanal: number
          id: string
          igi: number
          items: Json
          maniobras_puerto: number
          numero_contenedores: number
          order_number: string
          peso_total_kg: number
          prevalidacion: number
          purchase_date: string
          seguro: number
          status: string
          supplier: string
          total_cost: number
          total_landed: number
          updated_at: string
          user_id: string | null
          volumen_total_cbm: number
        }
        Insert: {
          arrival_port?: string
          comercializadora?: number
          country?: string
          created_at?: string
          currency?: string
          customs_cost?: number
          days_in_transit?: number
          departure_port?: string
          dta?: number
          estimated_arrival?: string | null
          estimated_departure?: string | null
          exchange_rate?: number
          flete_internacional_maritimo?: number
          flete_local_china?: number
          flete_terrestre_gdl?: number
          freight_cost?: number
          gastos_locales_naviera?: number
          honorarios_despacho_aduanal?: number
          id?: string
          igi?: number
          items?: Json
          maniobras_puerto?: number
          numero_contenedores?: number
          order_number?: string
          peso_total_kg?: number
          prevalidacion?: number
          purchase_date?: string
          seguro?: number
          status?: string
          supplier?: string
          total_cost?: number
          total_landed?: number
          updated_at?: string
          user_id?: string | null
          volumen_total_cbm?: number
        }
        Update: {
          arrival_port?: string
          comercializadora?: number
          country?: string
          created_at?: string
          currency?: string
          customs_cost?: number
          days_in_transit?: number
          departure_port?: string
          dta?: number
          estimated_arrival?: string | null
          estimated_departure?: string | null
          exchange_rate?: number
          flete_internacional_maritimo?: number
          flete_local_china?: number
          flete_terrestre_gdl?: number
          freight_cost?: number
          gastos_locales_naviera?: number
          honorarios_despacho_aduanal?: number
          id?: string
          igi?: number
          items?: Json
          maniobras_puerto?: number
          numero_contenedores?: number
          order_number?: string
          peso_total_kg?: number
          prevalidacion?: number
          purchase_date?: string
          seguro?: number
          status?: string
          supplier?: string
          total_cost?: number
          total_landed?: number
          updated_at?: string
          user_id?: string | null
          volumen_total_cbm?: number
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          created_at: string
          id: string
          movement_type: string
          notes: string | null
          product_id: string | null
          quantity: number
          reference_id: string
          reference_type: string
          total_cost: number
          unit_cost: number
          user_id: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string
          reference_type?: string
          total_cost?: number
          unit_cost?: number
          user_id?: string | null
          warehouse_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          movement_type?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          reference_id?: string
          reference_type?: string
          total_cost?: number
          unit_cost?: number
          user_id?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_cancellations: {
        Row: {
          canceled_at: string
          canceled_by: string
          cancellation_ack_path: string | null
          cancellation_reason: Database["public"]["Enums"]["cancellation_reason"]
          created_at: string
          id: string
          invoice_id: string
          substitute_uuid: string | null
          user_id: string | null
        }
        Insert: {
          canceled_at?: string
          canceled_by?: string
          cancellation_ack_path?: string | null
          cancellation_reason?: Database["public"]["Enums"]["cancellation_reason"]
          created_at?: string
          id?: string
          invoice_id: string
          substitute_uuid?: string | null
          user_id?: string | null
        }
        Update: {
          canceled_at?: string
          canceled_by?: string
          cancellation_ack_path?: string | null
          cancellation_reason?: Database["public"]["Enums"]["cancellation_reason"]
          created_at?: string
          id?: string
          invoice_id?: string
          substitute_uuid?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_cancellations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          description: string
          discount: number
          id: string
          invoice_id: string
          product_id: string | null
          qty: number
          sat_product_key: string
          sat_unit_key: string
          subtotal: number
          tax_amount: number
          total: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          invoice_id: string
          product_id?: string | null
          qty?: number
          sat_product_key?: string
          sat_unit_key?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string
          discount?: number
          id?: string
          invoice_id?: string
          product_id?: string | null
          qty?: number
          sat_product_key?: string
          sat_unit_key?: string
          subtotal?: number
          tax_amount?: number
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          canceled_at: string | null
          conditions: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          exchange_rate: number
          export_code: string | null
          folio: string
          id: string
          invoice_type: Database["public"]["Enums"]["cfdi_type"]
          issued_at: string | null
          notes: string | null
          order_id: string | null
          pac_provider: string | null
          pac_response: Json | null
          payment_form: string
          payment_method: string
          payment_status: string
          pdf_path: string | null
          sales_person_id: string | null
          series: string
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          total: number
          updated_at: string
          user_id: string | null
          uuid: string | null
          xml_path: string | null
        }
        Insert: {
          canceled_at?: string | null
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          export_code?: string | null
          folio?: string
          id?: string
          invoice_type?: Database["public"]["Enums"]["cfdi_type"]
          issued_at?: string | null
          notes?: string | null
          order_id?: string | null
          pac_provider?: string | null
          pac_response?: Json | null
          payment_form?: string
          payment_method?: string
          payment_status?: string
          pdf_path?: string | null
          sales_person_id?: string | null
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          uuid?: string | null
          xml_path?: string | null
        }
        Update: {
          canceled_at?: string | null
          conditions?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          export_code?: string | null
          folio?: string
          id?: string
          invoice_type?: Database["public"]["Enums"]["cfdi_type"]
          issued_at?: string | null
          notes?: string | null
          order_id?: string | null
          pac_provider?: string | null
          pac_response?: Json | null
          payment_form?: string
          payment_method?: string
          payment_status?: string
          pdf_path?: string | null
          sales_person_id?: string | null
          series?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          total?: number
          updated_at?: string
          user_id?: string | null
          uuid?: string | null
          xml_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
      order_payments: {
        Row: {
          amount: number
          comment: string
          created_at: string
          id: string
          method: string
          order_id: string
          payment_date: string
          reference: string
          registered_by: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          comment?: string
          created_at?: string
          id?: string
          method?: string
          order_id: string
          payment_date?: string
          reference?: string
          registered_by?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          comment?: string
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          payment_date?: string
          reference?: string
          registered_by?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          advance: number
          balance: number
          created_at: string
          customer_id: string | null
          customer_name: string
          delivery_notes: string | null
          edit_history: Json | null
          fecha_envio: string | null
          folio: string
          guia_numero: string | null
          id: string
          invoice_date_manual: string | null
          invoice_number_manual: string | null
          invoice_pdf_url: string | null
          items: Json
          order_type: Database["public"]["Enums"]["order_type"]
          promise_date: string | null
          quotation_folio: string | null
          reserve_deadline: string | null
          scheduled_delivery_date: string | null
          shipping_images: Json | null
          status: Database["public"]["Enums"]["order_status"]
          total: number
          transportista: string | null
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
          edit_history?: Json | null
          fecha_envio?: string | null
          folio: string
          guia_numero?: string | null
          id?: string
          invoice_date_manual?: string | null
          invoice_number_manual?: string | null
          invoice_pdf_url?: string | null
          items?: Json
          order_type?: Database["public"]["Enums"]["order_type"]
          promise_date?: string | null
          quotation_folio?: string | null
          reserve_deadline?: string | null
          scheduled_delivery_date?: string | null
          shipping_images?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          transportista?: string | null
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
          edit_history?: Json | null
          fecha_envio?: string | null
          folio?: string
          guia_numero?: string | null
          id?: string
          invoice_date_manual?: string | null
          invoice_number_manual?: string | null
          invoice_pdf_url?: string | null
          items?: Json
          order_type?: Database["public"]["Enums"]["order_type"]
          promise_date?: string | null
          quotation_folio?: string | null
          reserve_deadline?: string | null
          scheduled_delivery_date?: string | null
          shipping_images?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number
          transportista?: string | null
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
      payments: {
        Row: {
          amount: number
          bank: string | null
          complement_pdf_path: string | null
          complement_status: string
          complement_uuid: string | null
          complement_xml_path: string | null
          created_at: string
          created_by: string | null
          currency: string
          customer_id: string | null
          exchange_rate: number
          id: string
          invoice_id: string
          notes: string | null
          operation_reference: string | null
          payment_date: string
          payment_form: string
          previous_balance: number
          remaining_balance: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          amount: number
          bank?: string | null
          complement_pdf_path?: string | null
          complement_status?: string
          complement_uuid?: string | null
          complement_xml_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          id?: string
          invoice_id: string
          notes?: string | null
          operation_reference?: string | null
          payment_date?: string
          payment_form?: string
          previous_balance?: number
          remaining_balance?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          bank?: string | null
          complement_pdf_path?: string | null
          complement_status?: string
          complement_uuid?: string | null
          complement_xml_path?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          customer_id?: string | null
          exchange_rate?: number
          id?: string
          invoice_id?: string
          notes?: string | null
          operation_reference?: string | null
          payment_date?: string
          payment_form?: string
          previous_balance?: number
          remaining_balance?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      product_fiscal_data: {
        Row: {
          commercial_unit: string | null
          created_at: string
          fiscal_description: string | null
          id: string
          product_id: string
          sat_product_key: string
          sat_unit_key: string
          tax_object: string
          updated_at: string
          user_id: string | null
          vat_rate: number
        }
        Insert: {
          commercial_unit?: string | null
          created_at?: string
          fiscal_description?: string | null
          id?: string
          product_id: string
          sat_product_key?: string
          sat_unit_key?: string
          tax_object?: string
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Update: {
          commercial_unit?: string | null
          created_at?: string
          fiscal_description?: string | null
          id?: string
          product_id?: string
          sat_product_key?: string
          sat_unit_key?: string
          tax_object?: string
          updated_at?: string
          user_id?: string | null
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_fiscal_data_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
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
          images: Json
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
          images?: Json
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
          images?: Json
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
      purchases: {
        Row: {
          created_at: string
          date: string
          folio: string
          id: string
          items: Json
          notes: string | null
          products: string
          status: string
          supplier: string
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string
          folio?: string
          id?: string
          items?: Json
          notes?: string | null
          products?: string
          status?: string
          supplier?: string
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string
          folio?: string
          id?: string
          items?: Json
          notes?: string | null
          products?: string
          status?: string
          supplier?: string
          total?: number
          updated_at?: string
          user_id?: string | null
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
          goal_collections: number
          goal_followups: number
          goal_min_margin: number
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
          goal_collections?: number
          goal_followups?: number
          goal_min_margin?: number
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
          goal_collections?: number
          goal_followups?: number
          goal_min_margin?: number
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
      service_orders: {
        Row: {
          completed_date: string | null
          created_at: string
          customer_id: string
          customer_name: string
          description: string
          diagnosis: string | null
          folio: string
          id: string
          parts_used: string | null
          photos: Json
          product_name: string
          report_notes: string | null
          scheduled_date: string
          status: string
          technician_name: string
          type: string
          updated_at: string
          user_id: string | null
          work_performed: string | null
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          description?: string
          diagnosis?: string | null
          folio?: string
          id?: string
          parts_used?: string | null
          photos?: Json
          product_name?: string
          report_notes?: string | null
          scheduled_date?: string
          status?: string
          technician_name?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          work_performed?: string | null
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          customer_id?: string
          customer_name?: string
          description?: string
          diagnosis?: string | null
          folio?: string
          id?: string
          parts_used?: string | null
          photos?: Json
          product_name?: string
          report_notes?: string | null
          scheduled_date?: string
          status?: string
          technician_name?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          work_performed?: string | null
        }
        Relationships: []
      }
      spare_parts: {
        Row: {
          active: boolean
          cost: number
          created_at: string
          id: string
          image: string | null
          images: Json
          min_stock: number
          name: string
          price: number
          product_id: string
          product_name: string
          sku: string
          stock: number
          updated_at: string
          user_id: string | null
          warehouse: string
        }
        Insert: {
          active?: boolean
          cost?: number
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          min_stock?: number
          name: string
          price?: number
          product_id?: string
          product_name?: string
          sku?: string
          stock?: number
          updated_at?: string
          user_id?: string | null
          warehouse?: string
        }
        Update: {
          active?: boolean
          cost?: number
          created_at?: string
          id?: string
          image?: string | null
          images?: Json
          min_stock?: number
          name?: string
          price?: number
          product_id?: string
          product_name?: string
          sku?: string
          stock?: number
          updated_at?: string
          user_id?: string | null
          warehouse?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          banco_destino: string | null
          clabe_destino: string | null
          contact: string
          country: string
          created_at: string
          cuenta_destino: string | null
          currency: string
          divisa_banco: string | null
          email: string
          id: string
          name: string
          phone: string
          type: string
          updated_at: string
          user_id: string | null
          website: string | null
        }
        Insert: {
          banco_destino?: string | null
          clabe_destino?: string | null
          contact?: string
          country?: string
          created_at?: string
          cuenta_destino?: string | null
          currency?: string
          divisa_banco?: string | null
          email?: string
          id?: string
          name: string
          phone?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Update: {
          banco_destino?: string | null
          clabe_destino?: string | null
          contact?: string
          country?: string
          created_at?: string
          cuenta_destino?: string | null
          currency?: string
          divisa_banco?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          type?: string
          updated_at?: string
          user_id?: string | null
          website?: string | null
        }
        Relationships: []
      }
      team_members: {
        Row: {
          active: boolean
          address: string | null
          commission_rate: number | null
          contract_url: string | null
          created_at: string
          email: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          id: string
          name: string
          phone: string | null
          photo_url: string | null
          role: string
          series_current: number | null
          series_prefix: string | null
          series_start: number | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          commission_rate?: number | null
          contract_url?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          name: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          series_current?: number | null
          series_prefix?: string | null
          series_start?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          commission_rate?: number | null
          contract_url?: string | null
          created_at?: string
          email?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          id?: string
          name?: string
          phone?: string | null
          photo_url?: string | null
          role?: string
          series_current?: number | null
          series_prefix?: string | null
          series_start?: number | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
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
      warehouses: {
        Row: {
          created_at: string
          has_exhibition: boolean
          id: string
          location: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          has_exhibition?: boolean
          id?: string
          location?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          has_exhibition?: boolean
          id?: string
          location?: string
          name?: string
          updated_at?: string
          user_id?: string | null
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
      cancellation_reason: "01" | "02" | "03" | "04"
      cfdi_type: "I" | "E" | "P" | "N" | "T"
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
      invoice_status:
        | "borrador"
        | "lista_timbrar"
        | "timbrada"
        | "cancelada"
        | "error_timbrado"
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
      payment_status: "pendiente" | "parcial" | "pagada"
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
      cancellation_reason: ["01", "02", "03", "04"],
      cfdi_type: ["I", "E", "P", "N", "T"],
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
      invoice_status: [
        "borrador",
        "lista_timbrar",
        "timbrada",
        "cancelada",
        "error_timbrado",
      ],
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
      payment_status: ["pendiente", "parcial", "pagada"],
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
