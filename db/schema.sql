CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE conversation_status AS ENUM (
  'bot_active',
  'waiting_for_agent',
  'agent_active',
  'paused',
  'closed'
);

CREATE TYPE channel_provider AS ENUM (
  'web_widget',
  'official_site',
  'woocommerce',
  'whatsapp_cloud',
  'evolution_api',
  'telnyx',
  'plivo'
);

CREATE TABLE branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  city text NOT NULL,
  phone text NOT NULL,
  whatsapp text,
  address text NOT NULL,
  business_hours jsonb NOT NULL DEFAULT '{}',
  services text[] NOT NULL DEFAULT '{}',
  wholesale_contact text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'agent',
  skills text[] NOT NULL DEFAULT '{}',
  channels channel_provider[] NOT NULL DEFAULT '{}',
  is_online boolean NOT NULL DEFAULT false,
  active_conversations int NOT NULL DEFAULT 0,
  max_conversations int NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE faqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  short_answer text NOT NULL,
  long_answer text NOT NULL,
  category text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  related_services text[] NOT NULL DEFAULT '{}',
  branch_id uuid REFERENCES branches(id),
  priority int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  valid_from date,
  valid_until date,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('spanish', coalesce(question, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(short_answer, '')), 'B') ||
    setweight(to_tsvector('spanish', coalesce(long_answer, '')), 'C')
  ) STORED,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX faqs_search_idx ON faqs USING gin(search_vector);
CREATE INDEX faqs_question_trgm_idx ON faqs USING gin(question gin_trgm_ops);

CREATE TABLE routing_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  priority int NOT NULL DEFAULT 100,
  channel channel_provider,
  marketplace text,
  intent text,
  required_skill text,
  bot_allowed boolean NOT NULL DEFAULT true,
  fallback_message text NOT NULL,
  contact_branch_id uuid REFERENCES branches(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel channel_provider NOT NULL,
  external_conversation_id text,
  customer_name text,
  customer_phone text,
  status conversation_status NOT NULL DEFAULT 'bot_active',
  detected_intent text,
  marketplace text,
  assigned_agent_id uuid REFERENCES agents(id),
  paused_by uuid REFERENCES agents(id),
  paused_reason text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id),
  sender_type text NOT NULL CHECK (sender_type IN ('customer', 'bot', 'agent', 'system')),
  sender_id uuid,
  body text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL,
  name text NOT NULL,
  encrypted_config jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  agent_id uuid REFERENCES agents(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
