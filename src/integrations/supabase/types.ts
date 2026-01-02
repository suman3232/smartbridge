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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_numbers: {
        Row: {
          assignment_count: number | null
          created_at: string | null
          id: string
          is_active: boolean | null
          last_assigned_at: string | null
          phone_number: string
        }
        Insert: {
          assignment_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_assigned_at?: string | null
          phone_number: string
        }
        Update: {
          assignment_count?: number | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          last_assigned_at?: string | null
          phone_number?: string
        }
        Relationships: []
      }
      deals: {
        Row: {
          admin_contact_number: string | null
          admin_notes: string | null
          advance_amount: number
          card_offer_price: number
          commission_amount: number
          created_at: string | null
          customer_id: string | null
          delivery_address: string | null
          expected_buy_price: number
          id: string
          merchant_id: string
          original_price: number
          product_link: string
          product_name: string
          remaining_amount: number
          required_card: string
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
        }
        Insert: {
          admin_contact_number?: string | null
          admin_notes?: string | null
          advance_amount: number
          card_offer_price: number
          commission_amount: number
          created_at?: string | null
          customer_id?: string | null
          delivery_address?: string | null
          expected_buy_price: number
          id?: string
          merchant_id: string
          original_price: number
          product_link: string
          product_name: string
          remaining_amount: number
          required_card: string
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
        }
        Update: {
          admin_contact_number?: string | null
          admin_notes?: string | null
          advance_amount?: number
          card_offer_price?: number
          commission_amount?: number
          created_at?: string | null
          customer_id?: string | null
          delivery_address?: string | null
          expected_buy_price?: number
          id?: string
          merchant_id?: string
          original_price?: number
          product_link?: string
          product_name?: string
          remaining_amount?: number
          required_card?: string
          status?: Database["public"]["Enums"]["deal_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_confirmations: {
        Row: {
          confirmation_photo_url: string
          confirmed_at: string | null
          id: string
          merchant_id: string
          notes: string | null
          order_id: string
        }
        Insert: {
          confirmation_photo_url: string
          confirmed_at?: string | null
          id?: string
          merchant_id: string
          notes?: string | null
          order_id: string
        }
        Update: {
          confirmation_photo_url?: string
          confirmed_at?: string | null
          id?: string
          merchant_id?: string
          notes?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_confirmations_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_confirmations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      kycs: {
        Row: {
          account_number: string
          admin_notes: string | null
          bank_name: string
          created_at: string | null
          document_url: string
          id: string
          ifsc_code: string
          pan_number: string
          status: Database["public"]["Enums"]["kyc_status"] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_number: string
          admin_notes?: string | null
          bank_name: string
          created_at?: string | null
          document_url: string
          id?: string
          ifsc_code: string
          pan_number: string
          status?: Database["public"]["Enums"]["kyc_status"] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_number?: string
          admin_notes?: string | null
          bank_name?: string
          created_at?: string | null
          document_url?: string
          id?: string
          ifsc_code?: string
          pan_number?: string
          status?: Database["public"]["Enums"]["kyc_status"] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kycs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          customer_id: string
          deal_id: string
          delivery_otp: string | null
          id: string
          order_screenshot_url: string | null
          otp_verified: boolean | null
          status: Database["public"]["Enums"]["order_status"] | null
          tracking_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          deal_id: string
          delivery_otp?: string | null
          id?: string
          order_screenshot_url?: string | null
          otp_verified?: boolean | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          deal_id?: string
          delivery_otp?: string | null
          id?: string
          order_screenshot_url?: string | null
          otp_verified?: boolean | null
          status?: Database["public"]["Enums"]["order_status"] | null
          tracking_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_records: {
        Row: {
          id: string
          notes: string | null
          order_id: string
          otp_code: string
          status: string
          submitted_at: string | null
          submitted_by: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          id?: string
          notes?: string | null
          order_id: string
          otp_code: string
          status?: string
          submitted_at?: string | null
          submitted_by: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          id?: string
          notes?: string | null
          order_id?: string
          otp_code?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "otp_records_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_records_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "otp_records_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          deal_id: string | null
          description: string | null
          from_user_id: string | null
          id: string
          payment_type: string
          status: Database["public"]["Enums"]["payment_status"] | null
          to_user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          from_user_id?: string | null
          id?: string
          payment_type: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          to_user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          deal_id?: string | null
          description?: string | null
          from_user_id?: string | null
          id?: string
          payment_type?: string
          status?: Database["public"]["Enums"]["payment_status"] | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          phone: string | null
          preferred_role: Database["public"]["Enums"]["user_preference"] | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name: string
          id: string
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["user_preference"] | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          preferred_role?: Database["public"]["Enums"]["user_preference"] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number | null
          created_at: string | null
          id: string
          locked_amount: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          id?: string
          locked_amount?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          id?: string
          locked_amount?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
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
      accept_deal: {
        Args: { p_deal_id: string; p_delivery_address: string }
        Returns: {
          admin_contact_number: string | null
          admin_notes: string | null
          advance_amount: number
          card_offer_price: number
          commission_amount: number
          created_at: string | null
          customer_id: string | null
          delivery_address: string | null
          expected_buy_price: number
          id: string
          merchant_id: string
          original_price: number
          product_link: string
          product_name: string
          remaining_amount: number
          required_card: string
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      approve_deal: {
        Args: { deal_id: string }
        Returns: {
          admin_contact_number: string | null
          admin_notes: string | null
          advance_amount: number
          card_offer_price: number
          commission_amount: number
          created_at: string | null
          customer_id: string | null
          delivery_address: string | null
          expected_buy_price: number
          id: string
          merchant_id: string
          original_price: number
          product_link: string
          product_name: string
          remaining_amount: number
          required_card: string
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_deal_escrow: { Args: { p_deal_id: string }; Returns: undefined }
      get_next_admin_number: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      reject_deal: {
        Args: { deal_id: string; rejection_notes?: string }
        Returns: {
          admin_contact_number: string | null
          admin_notes: string | null
          advance_amount: number
          card_offer_price: number
          commission_amount: number
          created_at: string | null
          customer_id: string | null
          delivery_address: string | null
          expected_buy_price: number
          id: string
          merchant_id: string
          original_price: number
          product_link: string
          product_name: string
          remaining_amount: number
          required_card: string
          status: Database["public"]["Enums"]["deal_status"] | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "deals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin"
      deal_status:
        | "pending"
        | "approved"
        | "rejected"
        | "accepted"
        | "in_progress"
        | "completed"
        | "cancelled"
      kyc_status: "pending" | "approved" | "rejected"
      order_status:
        | "placed"
        | "otp_pending"
        | "otp_verified"
        | "shipped"
        | "delivered"
        | "confirmed"
      payment_status: "pending" | "locked" | "released" | "refunded"
      user_preference: "create_deals" | "accept_deals" | "both"
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
      app_role: ["admin"],
      deal_status: [
        "pending",
        "approved",
        "rejected",
        "accepted",
        "in_progress",
        "completed",
        "cancelled",
      ],
      kyc_status: ["pending", "approved", "rejected"],
      order_status: [
        "placed",
        "otp_pending",
        "otp_verified",
        "shipped",
        "delivered",
        "confirmed",
      ],
      payment_status: ["pending", "locked", "released", "refunded"],
      user_preference: ["create_deals", "accept_deals", "both"],
    },
  },
} as const
