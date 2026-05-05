export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericUpdatableView = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericNonUpdatableView = {
  Row: Record<string, unknown>;
  Relationships: GenericRelationship[];
};

type GenericView = GenericUpdatableView | GenericNonUpdatableView;

type GenericSetofOption = {
  isSetofReturn?: boolean;
  isOneToOne?: boolean;
  isNotNullable?: boolean;
  to: string;
  from: string;
};

type GenericFunction = {
  Args: Record<string, unknown> | never;
  Returns: unknown;
  SetofOptions?: GenericSetofOption;
};

export type Database = {
  public: {
    Tables: {
      communities: {
        Row: {
          id: string;
          name: string;
          slug: string;
          type: string | null;
          member_count: number | null;
          icon_url: string | null;
          risk_level: string | null;
          status?: string | null;
          requested_reason?: string | null;
          requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewed_note?: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          type?: string | null;
          member_count?: number | null;
          icon_url?: string | null;
          risk_level?: string | null;
          status?: string | null;
          requested_reason?: string | null;
          requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewed_note?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          type?: string | null;
          member_count?: number | null;
          icon_url?: string | null;
          risk_level?: string | null;
          status?: string | null;
          requested_reason?: string | null;
          requested_by?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          reviewed_note?: string | null;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      profiles: {
        Row: {
          id: string;
          username: string | null;
          display_name: string | null;
          avatar_url: string | null;
          bio: string | null;
          level: string | null;
          preferred_mode: string | null;
          onboarding_completed: boolean | null;
          onboarding_step?: number | null;
          karma_total?: number | null;
          karma_technical?: number | null;
          karma_predictions?: number | null;
          karma_scam_reports?: number | null;
          predictions_correct?: number | null;
          predictions_total?: number | null;
          is_moderator?: boolean | null;
          is_admin?: boolean | null;
          followed_tokens?: string[] | null;
          followed_communities?: string[] | null;
          notify_comment_replies?: boolean | null;
          notify_prediction_resolved?: boolean | null;
          notify_vote_milestone?: boolean | null;
          notify_scam_alerts?: boolean | null;
          price_alerts?: Json | null;
        };
        Insert: {
          id: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          level?: string | null;
          preferred_mode?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_step?: number | null;
          karma_total?: number | null;
          karma_technical?: number | null;
          karma_predictions?: number | null;
          karma_scam_reports?: number | null;
          predictions_correct?: number | null;
          predictions_total?: number | null;
          is_moderator?: boolean | null;
          is_admin?: boolean | null;
          followed_tokens?: string[] | null;
          followed_communities?: string[] | null;
          notify_comment_replies?: boolean | null;
          notify_prediction_resolved?: boolean | null;
          notify_vote_milestone?: boolean | null;
          notify_scam_alerts?: boolean | null;
          price_alerts?: Json | null;
        };
        Update: {
          id?: string;
          username?: string | null;
          display_name?: string | null;
          avatar_url?: string | null;
          bio?: string | null;
          level?: string | null;
          preferred_mode?: string | null;
          onboarding_completed?: boolean | null;
          onboarding_step?: number | null;
          karma_total?: number | null;
          karma_technical?: number | null;
          karma_predictions?: number | null;
          karma_scam_reports?: number | null;
          predictions_correct?: number | null;
          predictions_total?: number | null;
          is_moderator?: boolean | null;
          is_admin?: boolean | null;
          followed_tokens?: string[] | null;
          followed_communities?: string[] | null;
          notify_comment_replies?: boolean | null;
          notify_prediction_resolved?: boolean | null;
          notify_vote_milestone?: boolean | null;
          notify_scam_alerts?: boolean | null;
          price_alerts?: Json | null;
        };
        Relationships: GenericRelationship[];
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          community_id: string;
          title: string;
          content: string | null;
          type: string | null;
          tag: string | null;
          url: string | null;
          what_happened?: string | null;
          why_it_matters?: string | null;
          who_is_affected?: string | null;
          anchored_coin_id: string | null;
          price_at_post: number | null;
          risk_indicator: string | null;
          bullish_votes: number | null;
          bearish_votes: number | null;
          scam_reports: number | null;
          is_flagged: boolean | null;
          comment_count: number | null;
          is_removed: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          author_id: string;
          community_id: string;
          title: string;
          content?: string | null;
          type?: string | null;
          tag?: string | null;
          url?: string | null;
          what_happened?: string | null;
          why_it_matters?: string | null;
          who_is_affected?: string | null;
          anchored_coin_id?: string | null;
          price_at_post?: number | null;
          risk_indicator?: string | null;
          bullish_votes?: number | null;
          bearish_votes?: number | null;
          scam_reports?: number | null;
          is_flagged?: boolean | null;
          comment_count?: number | null;
          is_removed?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          author_id?: string;
          community_id?: string;
          title?: string;
          content?: string | null;
          type?: string | null;
          tag?: string | null;
          url?: string | null;
          what_happened?: string | null;
          why_it_matters?: string | null;
          who_is_affected?: string | null;
          anchored_coin_id?: string | null;
          price_at_post?: number | null;
          risk_indicator?: string | null;
          bullish_votes?: number | null;
          bearish_votes?: number | null;
          scam_reports?: number | null;
          is_flagged?: boolean | null;
          comment_count?: number | null;
          is_removed?: boolean | null;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string | null;
          parent_id: string | null;
          content: string;
          upvotes: number | null;
          downvotes: number | null;
          is_removed: boolean | null;
          is_flagged: boolean | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id?: string | null;
          parent_id?: string | null;
          content: string;
          upvotes?: number | null;
          downvotes?: number | null;
          is_removed?: boolean | null;
          is_flagged?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string | null;
          parent_id?: string | null;
          content?: string;
          upvotes?: number | null;
          downvotes?: number | null;
          is_removed?: boolean | null;
          is_flagged?: boolean | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      votes: {
        Row: {
          id: string;
          user_id: string;
          target_type: string;
          target_id: string;
          vote_type: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          target_type: string;
          target_id: string;
          vote_type: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          target_type?: string;
          target_id?: string;
          vote_type?: string;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      predictions: {
        Row: {
          id: string;
          user_id: string;
          coin_id: string;
          coin_symbol: string;
          direction: string;
          target_price: number;
          target_date: string;
          description: string | null;
          price_at_creation: number | null;
          price_at_resolution: number | null;
          status: string;
          resolved_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          coin_id: string;
          coin_symbol: string;
          direction: string;
          target_price: number;
          target_date: string;
          description?: string | null;
          price_at_creation?: number | null;
          price_at_resolution?: number | null;
          status?: string;
          resolved_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          coin_id?: string;
          coin_symbol?: string;
          direction?: string;
          target_price?: number;
          target_date?: string;
          description?: string | null;
          price_at_creation?: number | null;
          price_at_resolution?: number | null;
          status?: string;
          resolved_at?: string | null;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      scam_reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          target_type: string;
          target_id: string | null;
          project_name: string | null;
          reason: string;
          description: string | null;
          evidence_url: string | null;
          status: string;
          reviewed_by: string | null;
          reviewed_at: string | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          target_type: string;
          target_id?: string | null;
          project_name?: string | null;
          reason: string;
          description?: string | null;
          evidence_url?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          reporter_id?: string | null;
          target_type?: string;
          target_id?: string | null;
          project_name?: string | null;
          reason?: string;
          description?: string | null;
          evidence_url?: string | null;
          status?: string;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      token_profiles: {
        Row: {
          id: string;
          coin_id: string;
          symbol: string;
          name: string;
          has_real_product: boolean | null;
          team_is_public: boolean | null;
          launch_date: string | null;
          website_url: string | null;
          whitepaper_url: string | null;
          is_reported: boolean | null;
          report_count: number | null;
          community_summary: string | null;
          risk_score: number | null;
          created_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          id?: string;
          coin_id: string;
          symbol: string;
          name: string;
          has_real_product?: boolean | null;
          team_is_public?: boolean | null;
          launch_date?: string | null;
          website_url?: string | null;
          whitepaper_url?: string | null;
          is_reported?: boolean | null;
          report_count?: number | null;
          community_summary?: string | null;
          risk_score?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          id?: string;
          coin_id?: string;
          symbol?: string;
          name?: string;
          has_real_product?: boolean | null;
          team_is_public?: boolean | null;
          launch_date?: string | null;
          website_url?: string | null;
          whitepaper_url?: string | null;
          is_reported?: boolean | null;
          report_count?: number | null;
          community_summary?: string | null;
          risk_score?: number | null;
          created_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          title: string;
          body: string | null;
          link: string | null;
          is_read: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          title: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          link?: string | null;
          is_read?: boolean | null;
          created_at?: string | null;
        };
        Relationships: GenericRelationship[];
      };
    } & Record<string, GenericTable>;
    Views: Record<string, GenericView>;
    Functions: Record<string, GenericFunction>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Prediction = Database["public"]["Tables"]["predictions"]["Row"];
export type ScamReport = Database["public"]["Tables"]["scam_reports"]["Row"];
export type TokenProfile = Database["public"]["Tables"]["token_profiles"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
