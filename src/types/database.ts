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
      activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
          organization_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_claims: {
        Row: {
          claim_text: string
          conversation_id: string | null
          created_at: string
          id: string
          kind: string | null
          message_id: string | null
          organization_id: string
          source_ref: string | null
        }
        Insert: {
          claim_text: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          message_id?: string | null
          organization_id: string
          source_ref?: string | null
        }
        Update: {
          claim_text?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          kind?: string | null
          message_id?: string | null
          organization_id?: string
          source_ref?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_claims_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_claims_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_claims_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_preview_attachments: {
        Row: {
          created_at: string
          extracted_text: string | null
          filename: string
          id: string
          kind: string
          message_id: string | null
          mime_type: string
          organization_id: string
          session_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          extracted_text?: string | null
          filename: string
          id?: string
          kind: string
          message_id?: string | null
          mime_type: string
          organization_id: string
          session_id: string
          size_bytes?: number
          storage_path: string
        }
        Update: {
          created_at?: string
          extracted_text?: string | null
          filename?: string
          id?: string
          kind?: string
          message_id?: string | null
          mime_type?: string
          organization_id?: string
          session_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_preview_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "assistant_preview_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_preview_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_preview_attachments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_preview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_preview_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          parts: Json | null
          role: string
          session_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          parts?: Json | null
          role: string
          session_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          parts?: Json | null
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_preview_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_preview_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "assistant_preview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_preview_personas: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          label: string
          last_name: string | null
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string
          preferred_language: string | null
          sort_order: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          label: string
          last_name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone: string
          preferred_language?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          label?: string
          last_name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string
          preferred_language?: string | null
          sort_order?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_preview_personas_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_preview_sessions: {
        Row: {
          assistant_id: string
          created_at: string
          created_by: string
          id: string
          last_message_at: string
          organization_id: string
          persona_id: string | null
          persona_snapshot: Json | null
          title: string | null
        }
        Insert: {
          assistant_id: string
          created_at?: string
          created_by: string
          id?: string
          last_message_at?: string
          organization_id: string
          persona_id?: string | null
          persona_snapshot?: Json | null
          title?: string | null
        }
        Update: {
          assistant_id?: string
          created_at?: string
          created_by?: string
          id?: string
          last_message_at?: string
          organization_id?: string
          persona_id?: string | null
          persona_snapshot?: Json | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assistant_preview_sessions_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_preview_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assistant_preview_sessions_persona_id_fkey"
            columns: ["persona_id"]
            isOneToOne: false
            referencedRelation: "assistant_preview_personas"
            referencedColumns: ["id"]
          },
        ]
      }
      assistants: {
        Row: {
          channel_id: string | null
          created_at: string
          id: string
          model: string
          name: string
          organization_id: string
          settings: Json
          status: string
          system_prompt: string | null
          tone: string | null
          updated_at: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          id?: string
          model?: string
          name: string
          organization_id: string
          settings?: Json
          status?: string
          system_prompt?: string | null
          tone?: string | null
          updated_at?: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          id?: string
          model?: string
          name?: string
          organization_id?: string
          settings?: Json
          status?: string
          system_prompt?: string | null
          tone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistants_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          organization_id: string
          phone_number: string | null
          provider: string
          settings: Json
          status: string
          updated_at: string
          wa_access_token_secret_id: string | null
          wa_app_id: string | null
          wa_phone_number_id: string | null
          waba_id: string | null
          webhook_token: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          organization_id: string
          phone_number?: string | null
          provider?: string
          settings?: Json
          status?: string
          updated_at?: string
          wa_access_token_secret_id?: string | null
          wa_app_id?: string | null
          wa_phone_number_id?: string | null
          waba_id?: string | null
          webhook_token?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          organization_id?: string
          phone_number?: string | null
          provider?: string
          settings?: Json
          status?: string
          updated_at?: string
          wa_access_token_secret_id?: string | null
          wa_app_id?: string | null
          wa_phone_number_id?: string | null
          waba_id?: string | null
          webhook_token?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          last_seen_at: string
          name: string | null
          nationality: string | null
          notes: string | null
          organization_id: string
          phone: string
          preferred_language: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_seen_at?: string
          name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id: string
          phone: string
          preferred_language?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          last_seen_at?: string
          name?: string | null
          nationality?: string | null
          notes?: string | null
          organization_id?: string
          phone?: string
          preferred_language?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel_id: string | null
          contact_id: string | null
          created_at: string
          guest_name: string | null
          guest_phone: string
          id: string
          language: string
          last_message_at: string
          last_message_preview: string | null
          last_read_at: string | null
          organization_id: string
          pinned_at: string | null
          status: string
          turn_lock_message_id: string | null
          turn_locked_at: string | null
          unread_count: number
        }
        Insert: {
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string
          guest_name?: string | null
          guest_phone: string
          id?: string
          language?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_read_at?: string | null
          organization_id: string
          pinned_at?: string | null
          status?: string
          turn_lock_message_id?: string | null
          turn_locked_at?: string | null
          unread_count?: number
        }
        Update: {
          channel_id?: string | null
          contact_id?: string | null
          created_at?: string
          guest_name?: string | null
          guest_phone?: string
          id?: string
          language?: string
          last_message_at?: string
          last_message_preview?: string | null
          last_read_at?: string | null
          organization_id?: string
          pinned_at?: string | null
          status?: string
          turn_lock_message_id?: string | null
          turn_locked_at?: string | null
          unread_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "conversations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation_permissions: {
        Row: {
          invitation_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          invitation_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          invitation_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "invitation_permissions_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          first_name: string | null
          id: string
          invited_by: string | null
          last_name: string | null
          organization_id: string
          role_id: string
          status: string
          token: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          organization_id: string
          role_id: string
          status?: string
          token: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          first_name?: string | null
          id?: string
          invited_by?: string | null
          last_name?: string | null
          organization_id?: string
          role_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          assistant_id: string | null
          chunk_index: number
          content: string
          created_at: string
          embedding: string | null
          id: string
          image_url: string | null
          organization_id: string
          source_id: string
          token_count: number | null
        }
        Insert: {
          assistant_id?: string | null
          chunk_index?: number
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          image_url?: string | null
          organization_id: string
          source_id: string
          token_count?: number | null
        }
        Update: {
          assistant_id?: string | null
          chunk_index?: number
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          image_url?: string | null
          organization_id?: string
          source_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "knowledge_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_folders: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          organization_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          organization_id: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          organization_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_folders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_sources: {
        Row: {
          assistant_id: string | null
          auto_refresh: boolean
          auto_remove: boolean
          category: string
          content: string | null
          crawl_config: Json | null
          created_at: string
          created_by: string | null
          error: string | null
          file_ext: string | null
          folder_id: string | null
          id: string
          kind: string
          last_refreshed_at: string | null
          mime_type: string | null
          organization_id: string
          raw_ref: string | null
          size_bytes: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assistant_id?: string | null
          auto_refresh?: boolean
          auto_remove?: boolean
          category?: string
          content?: string | null
          crawl_config?: Json | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_ext?: string | null
          folder_id?: string | null
          id?: string
          kind: string
          last_refreshed_at?: string | null
          mime_type?: string | null
          organization_id: string
          raw_ref?: string | null
          size_bytes?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assistant_id?: string | null
          auto_refresh?: boolean
          auto_remove?: boolean
          category?: string
          content?: string | null
          crawl_config?: Json | null
          created_at?: string
          created_by?: string | null
          error?: string | null
          file_ext?: string | null
          folder_id?: string | null
          id?: string
          kind?: string
          last_refreshed_at?: string | null
          mime_type?: string | null
          organization_id?: string
          raw_ref?: string | null
          size_bytes?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_assistant_id_fkey"
            columns: ["assistant_id"]
            isOneToOne: false
            referencedRelation: "assistants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_sources_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "knowledge_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      mcp_servers: {
        Row: {
          auth_header_name: string | null
          auth_kind: string
          auth_secret_id: string | null
          created_at: string
          enabled: boolean
          error: string | null
          headers: Json
          id: string
          link_params: string[]
          name: string
          organization_id: string
          query_params: Json
          slug: string
          status: string
          timeout_ms: number
          tools: Json
          tools_synced_at: string | null
          transport: string
          updated_at: string
          url: string
        }
        Insert: {
          auth_header_name?: string | null
          auth_kind?: string
          auth_secret_id?: string | null
          created_at?: string
          enabled?: boolean
          error?: string | null
          headers?: Json
          id?: string
          link_params?: string[]
          name: string
          organization_id: string
          query_params?: Json
          slug: string
          status?: string
          timeout_ms?: number
          tools?: Json
          tools_synced_at?: string | null
          transport?: string
          updated_at?: string
          url: string
        }
        Update: {
          auth_header_name?: string | null
          auth_kind?: string
          auth_secret_id?: string | null
          created_at?: string
          enabled?: boolean
          error?: string | null
          headers?: Json
          id?: string
          link_params?: string[]
          name?: string
          organization_id?: string
          query_params?: Json
          slug?: string
          status?: string
          timeout_ms?: number
          tools?: Json
          tools_synced_at?: string | null
          transport?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "mcp_servers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          metadata: Json
          organization_id: string
          provider_message_id: string | null
          rich_content: Json | null
          role: string
          sender_user_id: string | null
          tool_trace: Json | null
          type: string
        }
        Insert: {
          body?: string
          conversation_id: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id: string
          provider_message_id?: string | null
          rich_content?: Json | null
          role: string
          sender_user_id?: string | null
          tool_trace?: Json | null
          type?: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          organization_id?: string
          provider_message_id?: string | null
          rich_content?: Json | null
          role?: string
          sender_user_id?: string | null
          tool_trace?: Json | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_member_permissions: {
        Row: {
          organization_member_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Insert: {
          organization_member_id: string
          permission: Database["public"]["Enums"]["app_permission"]
        }
        Update: {
          organization_member_id?: string
          permission?: Database["public"]["Enums"]["app_permission"]
        }
        Relationships: [
          {
            foreignKeyName: "organization_member_permissions_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          joined_at: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          organization_id: string
          role_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          organization_id?: string
          role_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: Json | null
          company_info: Json | null
          contact: Json | null
          created_at: string
          currency: string
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          settings: Json
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          address?: Json | null
          company_info?: Json | null
          contact?: Json | null
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          settings?: Json
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          address?: Json | null
          company_info?: Json | null
          contact?: Json | null
          created_at?: string
          currency?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          settings?: Json
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          department: string | null
          first_name: string | null
          id: string
          job_title: string | null
          last_login_at: string | null
          last_name: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          first_name?: string | null
          id: string
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          department?: string | null
          first_name?: string | null
          id?: string
          job_title?: string | null
          last_login_at?: string | null
          last_name?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Insert: {
          permission: Database["public"]["Enums"]["app_permission"]
          role_id: string
        }
        Update: {
          permission?: Database["public"]["Enums"]["app_permission"]
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      whatsapp_media_cache: {
        Row: {
          byte_size: number
          created_at: string
          expires_at: string
          id: string
          media_id: string
          mime_type: string
          organization_id: string
          phone_number_id: string
          source_url: string
          source_url_hash: string
        }
        Insert: {
          byte_size: number
          created_at?: string
          expires_at: string
          id?: string
          media_id: string
          mime_type: string
          organization_id: string
          phone_number_id: string
          source_url: string
          source_url_hash: string
        }
        Update: {
          byte_size?: number
          created_at?: string
          expires_at?: string
          id?: string
          media_id?: string
          mime_type?: string
          organization_id?: string
          phone_number_id?: string
          source_url?: string
          source_url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_media_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      authorize_for_org: {
        Args: { p_org_id: string; p_permission: string }
        Returns: boolean
      }
      clear_mcp_server_secret: {
        Args: { p_server_id: string }
        Returns: undefined
      }
      create_organization_with_owner: {
        Args: {
          p_currency?: string
          p_industry?: string
          p_name: string
          p_slug: string
          p_timezone?: string
        }
        Returns: Json
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      get_channel_wa_token: { Args: { p_channel_id: string }; Returns: string }
      get_latest_guest_message_id: {
        Args: { p_conversation_id: string }
        Returns: string
      }
      get_mcp_server_secret: { Args: { p_server_id: string }; Returns: string }
      get_user_org_ids: { Args: never; Returns: string[] }
      get_user_permissions_for_org: {
        Args: { p_org_id: string }
        Returns: string[]
      }
      match_knowledge_chunks: {
        Args: {
          p_assistant_id: string
          p_match_count?: number
          p_min_similarity?: number
          p_org_id: string
          p_query_embedding: string
        }
        Returns: {
          content: string
          id: string
          image_url: string
          similarity: number
          source_id: string
        }[]
      }
      record_inbound_whatsapp_message: {
        Args: {
          p_body?: string
          p_channel_id: string
          p_country?: string
          p_metadata?: Json
          p_org_id: string
          p_phone: string
          p_profile_name?: string
          p_provider_message_id?: string
          p_type?: string
        }
        Returns: {
          contact_id: string
          conversation_id: string
          conversation_language: string
          conversation_status: string
          message_id: string
        }[]
      }
      release_conversation_turn: {
        Args: { p_conversation_id: string; p_trigger_message_id: string }
        Returns: undefined
      }
      set_channel_wa_token: {
        Args: { p_channel_id: string; p_token: string }
        Returns: undefined
      }
      set_mcp_server_secret: {
        Args: { p_secret: string; p_server_id: string }
        Returns: undefined
      }
      trigger_knowledge_ingest_sweep: { Args: never; Returns: undefined }
      trigger_knowledge_refresh: { Args: never; Returns: undefined }
      try_claim_conversation_turn: {
        Args: { p_conversation_id: string; p_trigger_message_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_permission:
        | "inbox.access"
        | "channels.access"
        | "knowledge.access"
        | "integrations.access"
        | "assistant.access"
        | "settings.members"
        | "settings.organization"
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
      app_permission: [
        "inbox.access",
        "channels.access",
        "knowledge.access",
        "integrations.access",
        "assistant.access",
        "settings.members",
        "settings.organization",
      ],
    },
  },
} as const

// Convenience aliases used across the codebase
export type KnowledgeSource = Tables<"knowledge_sources">
export type KnowledgeSourceInsert = TablesInsert<"knowledge_sources">
export type KnowledgeChunk = Tables<"knowledge_chunks">
export type Message = Tables<"messages">
export type Conversation = Tables<"conversations">
export type Contact = Tables<"contacts">
export type McpServer = Tables<"mcp_servers">
export type McpServerInsert = TablesInsert<"mcp_servers">
export type McpServerUpdate = TablesUpdate<"mcp_servers">
export type Organization = Tables<"organizations">
export type Profile = Tables<"profiles">
export type Assistant = Tables<"assistants">
export type Channel = Tables<"channels">
export type ActivityLog = Tables<"activity_logs">
export type KnowledgeFolder = Tables<"knowledge_folders">
export type Role = Tables<"roles">

// Narrow string types for columns that have a fixed set of values
export type ActivityLogAction = string
export type ActivityLogEntityType = string

// Joined query return shapes (not from a table row — defined by the query)
export type InvitationWithRole = Tables<"invitations"> & {
  roles: { name: string } | null
}
export type OrganizationMemberWithProfile = Tables<"organization_members"> & {
  profiles: Profile | null
  roles: { name: string; label: string } | null
}

export type CrawlConfig = {
  mode: "single" | "sitemap" | "whole"
  depth?: number
  maxUrls?: number
  pattern?: string
}

export type CrawlMode = CrawlConfig["mode"]
