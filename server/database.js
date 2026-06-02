import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SESSION_DAYS = 7;
const DEFAULT_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@hwhub.local";
const DEFAULT_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "change-this-password";

export async function createDataStore(defaultState) {
  if (!process.env.DATABASE_URL) {
    console.log("HWHub usando almacenamiento en memoria");
    return createMemoryStore(defaultState);
  }

  try {
    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query("select 1");
    await ensureAuthSchema(pool);
    await seedDatabase(pool, defaultState);
    console.log("HWHub conectado a PostgreSQL");
    return createPostgresStore(pool, defaultState);
  } catch (error) {
    console.warn(`No se pudo conectar a PostgreSQL, usando memoria: ${error.message}`);
    return createMemoryStore(defaultState);
  }
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash = "") {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    agentId: row.agent_id || null,
    isActive: row.is_active ?? row.isActive ?? true,
    createdAt: row.created_at || row.createdAt || null
  };
}

function sessionExpiry() {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

async function ensureAuthSchema(pool) {
  await pool.query(`
    create table if not exists conversation_events (
      id uuid primary key default gen_random_uuid(),
      conversation_id uuid not null references conversations(id) on delete cascade,
      event_type text not null,
      actor_type text not null default 'system',
      actor_id uuid,
      body text not null,
      metadata jsonb not null default '{}',
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create index if not exists conversation_events_conversation_idx
    on conversation_events (conversation_id, created_at desc)
  `);
  await pool.query(`
    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      email text unique not null,
      password_hash text not null,
      role text not null default 'viewer',
      agent_id uuid references agents(id),
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists sessions (
      id text primary key,
      user_id uuid not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create table if not exists integration_accounts (
      id uuid primary key default gen_random_uuid(),
      provider text not null,
      name text not null,
      encrypted_config jsonb not null,
      is_active boolean not null default true,
      created_at timestamptz not null default now()
    )
  `);
  await pool.query("alter table integration_accounts add column if not exists last_checked_at timestamptz");
  await pool.query("alter table integration_accounts add column if not exists last_check_status text");
  await pool.query("alter table integration_accounts add column if not exists last_check_message text");
}

function csv(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value) return [];
  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function branchFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    phone: row.phone,
    whatsapp: row.whatsapp,
    address: row.address,
    services: row.services || [],
    wholesaleContact: row.wholesale_contact,
    hours: row.business_hours?.label || row.business_hours?.hours || ""
  };
}

function agentFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    skills: row.skills || [],
    channels: row.channels || [],
    online: row.is_online,
    activeConversations: row.active_conversations,
    maxConversations: row.max_conversations
  };
}

function faqFromRow(row) {
  return {
    id: row.id,
    question: row.question,
    shortAnswer: row.short_answer,
    longAnswer: row.long_answer,
    category: row.category,
    tags: row.tags || [],
    published: row.is_published
  };
}

function ruleFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    priority: row.priority,
    channel: row.channel,
    marketplace: row.marketplace,
    intent: row.intent,
    requiredSkill: row.required_skill,
    botAllowed: row.bot_allowed,
    fallbackMessage: row.fallback_message
  };
}

function conversationFromRow(row) {
  return enrichConversation({
    id: row.id,
    channel: row.channel,
    customer: row.customer_name || "Visitante",
    customerPhone: row.customer_phone || row.customerPhone || null,
    status: row.status,
    intent: row.detected_intent,
    marketplace: row.marketplace,
    assignedAgentId: row.assigned_agent_id,
    externalConversationId: row.external_conversation_id || row.externalConversationId || null,
    metadata: row.metadata || {},
    lastMessage: row.last_message || row.metadata?.lastMessage || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  });
}

function enrichConversation(conversation) {
  const updated = conversation.updatedAt ? new Date(conversation.updatedAt) : new Date();
  const waitingMinutes = Math.max(0, Math.round((Date.now() - updated.getTime()) / 60000));
  const marketplace = conversation.marketplace || "";
  const urgentMarketplace = ["amazon", "mercadolibre", "walmart", "coppel", "elektra", "tiktok", "temu"].includes(marketplace);
  const needsAgent = ["waiting_for_agent", "paused"].includes(conversation.status);
  const priority =
    conversation.status === "closed" ? "normal" :
    waitingMinutes >= 30 || (needsAgent && urgentMarketplace) ? "urgent" :
    waitingMinutes >= 15 || needsAgent ? "high" :
    "normal";
  const slaState =
    conversation.status === "closed" ? "closed" :
    waitingMinutes >= 30 ? "breached" :
    waitingMinutes >= 15 ? "at_risk" :
    "ok";
  return { ...conversation, waitingMinutes, priority, slaState };
}

function messageFromRow(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderType: row.sender_type,
    senderId: row.sender_id,
    body: row.body,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

function eventFromRow(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    eventType: row.event_type,
    actorType: row.actor_type,
    actorId: row.actor_id,
    body: row.body,
    metadata: row.metadata || {},
    createdAt: row.created_at
  };
}

function integrationFromRow(row) {
  const config = row.encrypted_config || {};
  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    active: row.is_active,
    config: maskConfig(config),
    lastCheckedAt: row.last_checked_at || row.lastCheckedAt || null,
    lastCheckStatus: row.last_check_status || row.lastCheckStatus || null,
    lastCheckMessage: row.last_check_message || row.lastCheckMessage || null
  };
}

async function seedDatabase(pool, defaults) {
  const { rows } = await pool.query(`
    select
      (select count(*)::int from branches) as branches,
      (select count(*)::int from agents) as agents,
      (select count(*)::int from faqs) as faqs,
      (select count(*)::int from routing_rules) as rules
  `);
  const counts = rows[0];

  if (!counts.branches) {
    for (const branch of defaults.branches) {
      await pool.query(
        `insert into branches (name, city, phone, whatsapp, address, business_hours, services, wholesale_contact)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          branch.name,
          branch.city,
          branch.phone,
          branch.whatsapp,
          branch.address,
          { label: branch.hours },
          branch.services,
          branch.wholesaleContact
        ]
      );
    }
  }

  if (!counts.agents) {
    for (const agent of defaults.agents) {
      await pool.query(
        `insert into agents (name, email, role, skills, channels, is_online, active_conversations, max_conversations)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          agent.name,
          `${agent.id}@hwhub.local`,
          agent.role,
          agent.skills,
          agent.channels,
          agent.online,
          agent.activeConversations,
          agent.maxConversations
        ]
      );
    }
  }

  if (!counts.faqs) {
    for (const faq of defaults.faqs) {
      await pool.query(
        `insert into faqs (question, short_answer, long_answer, category, tags, is_published)
         values ($1, $2, $3, $4, $5, $6)`,
        [faq.question, faq.shortAnswer, faq.longAnswer, faq.category, faq.tags, faq.published]
      );
    }
  }

  if (!counts.rules) {
    for (const rule of defaults.routingRules) {
      await pool.query(
        `insert into routing_rules
          (name, priority, channel, marketplace, intent, required_skill, bot_allowed, fallback_message)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          rule.name,
          rule.priority,
          rule.channel,
          rule.marketplace,
          rule.intent,
          rule.requiredSkill,
          rule.botAllowed,
          rule.fallbackMessage
        ]
      );
    }
  }

  const users = await pool.query("select count(*)::int as count from users");
  if (!users.rows[0].count) {
    await pool.query(
      `insert into users (name, email, password_hash, role)
       values ($1, $2, $3, 'admin')`,
      ["Administrador", DEFAULT_ADMIN_EMAIL.toLowerCase(), hashPassword(DEFAULT_ADMIN_PASSWORD)]
    );
  }
}

function createMemoryStore(state) {
  state.users ||= [
    {
      id: "user-admin",
      name: "Administrador",
      email: DEFAULT_ADMIN_EMAIL.toLowerCase(),
      passwordHash: hashPassword(DEFAULT_ADMIN_PASSWORD),
      role: "admin",
      agentId: null,
      isActive: true
    }
  ];
  state.sessions ||= [];

  return {
    mode: "memory",
    async bootstrap() {
      return {
        ...state,
        conversations: state.conversations.map((conversation) => enrichConversation(conversation)),
        integrations: state.integrations || []
      };
    },
    async collection(name) {
      return state[name] || [];
    },
    async create(name, payload) {
      const item = { id: `${name}-${Date.now()}`, ...normalizePayload(name, payload) };
      state[name].unshift(item);
      return item;
    },
    async update(name, id, payload) {
      const index = state[name].findIndex((item) => item.id === id);
      if (index < 0) return null;
      state[name][index] = { ...state[name][index], ...normalizePayload(name, payload) };
      return state[name][index];
    },
    async remove(name, id) {
      const index = state[name].findIndex((item) => item.id === id);
      if (index < 0) return false;
      state[name].splice(index, 1);
      return true;
    },
    async createConversation(conversation) {
      state.messages ||= [];
      state.conversationEvents ||= [];
      conversation.createdAt ||= new Date().toISOString();
      conversation.updatedAt ||= conversation.createdAt;
      state.conversations.unshift(conversation);
      state.messages.push({
        id: `messages-${Date.now()}`,
        conversationId: conversation.id,
        senderType: "customer",
        senderId: null,
        body: conversation.lastMessage,
        createdAt: new Date().toISOString()
      });
      state.conversationEvents.push({
        id: `event-${Date.now()}`,
        conversationId: conversation.id,
        eventType: "conversation.created",
        actorType: "system",
        actorId: null,
        body: `Conversacion creada en ${conversation.channel}`,
        metadata: { intent: conversation.intent, marketplace: conversation.marketplace, status: conversation.status },
        createdAt: new Date().toISOString()
      });
      return conversation;
    },
    async conversationById(id) {
      return state.conversations.find((item) => item.id === id) || null;
    },
    async activeConversationByExternalId(externalId, channel) {
      if (!externalId) return null;
      return state.conversations.find(
        (item) =>
          item.externalConversationId === externalId &&
          item.channel === channel &&
          item.status !== "closed"
      ) || null;
    },
    async updateConversationContext(id, payload) {
      const conversation = state.conversations.find((item) => item.id === id);
      if (!conversation) return null;
      if (payload.customer) conversation.customer = payload.customer;
      if (payload.customerPhone) conversation.customerPhone = payload.customerPhone;
      if (payload.externalConversationId) conversation.externalConversationId = payload.externalConversationId;
      if (payload.status) conversation.status = payload.status;
      if (payload.intent) conversation.intent = payload.intent;
      if (payload.marketplace) conversation.marketplace = payload.marketplace;
      if (payload.assignedAgentId !== undefined) conversation.assignedAgentId = payload.assignedAgentId;
      conversation.metadata = { ...(conversation.metadata || {}), ...(payload.metadata || {}) };
      conversation.updatedAt = new Date().toISOString();
      return enrichConversation(conversation);
    },
    async messages(conversationId) {
      return state.messages?.filter((item) => item.conversationId === conversationId) || [];
    },
    async events(conversationId) {
      return (state.conversationEvents || [])
        .filter((item) => item.conversationId === conversationId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    },
    async addEvent(conversationId, payload) {
      state.conversationEvents ||= [];
      const event = {
        id: `event-${Date.now()}`,
        conversationId,
        eventType: payload.eventType || "system.note",
        actorType: payload.actorType || "system",
        actorId: payload.actorId || null,
        body: payload.body || "",
        metadata: payload.metadata || {},
        createdAt: new Date().toISOString()
      };
      state.conversationEvents.push(event);
      return event;
    },
    async addMessage(conversationId, payload) {
      state.messages ||= [];
      const message = {
        id: `messages-${Date.now()}`,
        conversationId,
        senderType: payload.senderType || "agent",
        senderId: payload.senderId || null,
        body: payload.body || "",
        metadata: payload.metadata || {},
        createdAt: new Date().toISOString()
      };
      state.messages.push(message);
      const conversation = state.conversations.find((item) => item.id === conversationId);
      if (conversation) {
        conversation.lastMessage = message.body;
        conversation.updatedAt = new Date().toISOString();
      }
      await this.addEvent(conversationId, {
        eventType: "message.created",
        actorType: payload.senderType || "agent",
        actorId: payload.senderId || null,
        body: `Mensaje ${payload.senderType || "agent"} agregado`,
        metadata: { preview: message.body.slice(0, 120) }
      });
      return message;
    },
    async updateConversationStatus(id, status) {
      const conversation = state.conversations.find((item) => item.id === id);
      if (!conversation) return null;
      const previousStatus = conversation.status;
      conversation.status = status;
      conversation.updatedAt = new Date().toISOString();
      await this.addEvent(id, {
        eventType: "conversation.status_changed",
        actorType: "system",
        body: `Estado cambiado de ${previousStatus} a ${status}`,
        metadata: { previousStatus, status }
      });
      return conversation;
    },
    async integrations() {
      const seen = new Set();
      return (state.integrations || []).filter((item) => {
        const key = `${item.provider}:${String(item.name).toLowerCase()}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    async saveIntegration(payload) {
      state.integrations ||= [];
      const config = parseConfig(payload.config);
      const item = {
        id: payload.id || `integrations-${Date.now()}`,
        provider: payload.provider,
        name: payload.name,
        active: Boolean(payload.active),
        config,
        lastCheckedAt: null,
        lastCheckStatus: null,
        lastCheckMessage: null
      };
      const index = state.integrations.findIndex(
        (entry) =>
          entry.id === item.id ||
          (entry.provider === item.provider && String(entry.name).toLowerCase() === String(item.name).toLowerCase())
      );
      if (index >= 0) {
        const previous = state.integrations[index];
        item.id = state.integrations[index].id;
        item.config = Object.keys(config).length ? { ...state.integrations[index].config, ...config } : state.integrations[index].config;
        item.lastCheckedAt = previous.lastCheckedAt || null;
        item.lastCheckStatus = previous.lastCheckStatus || null;
        item.lastCheckMessage = previous.lastCheckMessage || null;
        state.integrations[index] = item;
      }
      else state.integrations.unshift(item);
      return { ...item, config: maskConfig(item.config) };
    },
    async integrationById(id) {
      return (state.integrations || []).find((entry) => entry.id === id) || null;
    },
    async recordIntegrationCheck(id, result) {
      const item = (state.integrations || []).find((entry) => entry.id === id);
      if (!item) return null;
      item.lastCheckedAt = new Date().toISOString();
      item.lastCheckStatus = result.ok ? "ok" : "error";
      item.lastCheckMessage = result.message;
      return { ...item, config: maskConfig(item.config) };
    },
    async deleteIntegration(id) {
      const before = state.integrations?.length || 0;
      state.integrations = (state.integrations || []).filter((entry) => entry.id !== id);
      return before !== state.integrations.length;
    },
    async integrationConfig(provider) {
      const item = (state.integrations || []).find((entry) => entry.provider === provider && entry.active !== false);
      return item?.config || null;
    },
    async authenticate(email, password) {
      const user = state.users.find((item) => item.email === String(email || "").toLowerCase() && item.isActive);
      if (!user || !verifyPassword(password || "", user.passwordHash)) return null;
      return publicUser({ ...user, agent_id: user.agentId });
    },
    async createSession(userId) {
      const session = {
        id: randomBytes(32).toString("hex"),
        userId,
        expiresAt: sessionExpiry()
      };
      state.sessions.push(session);
      return session;
    },
    async userFromSession(sessionId) {
      const session = state.sessions.find((item) => item.id === sessionId && item.expiresAt > new Date());
      if (!session) return null;
      const user = state.users.find((item) => item.id === session.userId && item.isActive);
      return publicUser(user ? { ...user, agent_id: user.agentId } : null);
    },
    async deleteSession(sessionId) {
      state.sessions = state.sessions.filter((item) => item.id !== sessionId);
    },
    async users() {
      return state.users.map((user) => publicUser({ ...user, agent_id: user.agentId, is_active: user.isActive }));
    },
    async saveUser(payload) {
      const item = normalizeUserPayload(payload);
      if (item.id) {
        const user = state.users.find((entry) => entry.id === item.id);
        if (!user) return null;
        user.name = item.name;
        user.email = item.email;
        user.role = item.role;
        user.agentId = item.agentId;
        user.isActive = item.isActive;
        if (item.password) user.passwordHash = hashPassword(item.password);
        return publicUser({ ...user, agent_id: user.agentId, is_active: user.isActive });
      }
      const user = {
        id: `user-${Date.now()}`,
        name: item.name,
        email: item.email,
        role: item.role,
        agentId: item.agentId,
        isActive: item.isActive,
        passwordHash: hashPassword(item.password || randomBytes(12).toString("hex")),
        createdAt: new Date().toISOString()
      };
      state.users.unshift(user);
      return publicUser({ ...user, agent_id: user.agentId, is_active: user.isActive });
    },
    async updatePassword(userId, password) {
      const user = state.users.find((entry) => entry.id === userId);
      if (!user) return null;
      user.passwordHash = hashPassword(password);
      return publicUser({ ...user, agent_id: user.agentId, is_active: user.isActive });
    }
  };
}

function createPostgresStore(pool, fallbackState) {
  return {
    mode: "postgres",
    async bootstrap() {
      const [branches, agents, faqs, routingRules, conversations, integrations] = await Promise.all([
        this.collection("branches"),
        this.collection("agents"),
        this.collection("faqs"),
        this.collection("routingRules"),
        this.collection("conversations"),
        this.integrations()
      ]);
      return { branches, agents, faqs, routingRules, conversations, integrations };
    },
    async collection(name) {
      if (name === "branches") {
        const { rows } = await pool.query("select * from branches where is_active = true order by created_at desc");
        return rows.map(branchFromRow);
      }
      if (name === "agents") {
        const { rows } = await pool.query("select * from agents order by created_at desc");
        return rows.map(agentFromRow);
      }
      if (name === "faqs") {
        const { rows } = await pool.query("select * from faqs order by priority desc, updated_at desc");
        return rows.map(faqFromRow);
      }
      if (name === "routingRules") {
        const { rows } = await pool.query("select * from routing_rules where is_active = true order by priority asc");
        return rows.map(ruleFromRow);
      }
      if (name === "conversations") {
        const { rows } = await pool.query(`
          select c.*, m.body as last_message
          from conversations c
          left join lateral (
            select body from messages where conversation_id = c.id order by created_at desc limit 1
          ) m on true
          order by c.updated_at desc
          limit 100
        `);
        return rows.map(conversationFromRow);
      }
      return fallbackState[name] || [];
    },
    async create(name, payload) {
      if (name === "faqs") return createFaq(pool, payload);
      if (name === "branches") return createBranch(pool, payload);
      if (name === "agents") return createAgent(pool, payload);
      if (name === "routingRules") return createRoutingRule(pool, payload);
      throw new Error(`Unsupported collection: ${name}`);
    },
    async update(name, id, payload) {
      if (name === "faqs") return updateFaq(pool, id, payload);
      if (name === "branches") return updateBranch(pool, id, payload);
      if (name === "agents") return updateAgent(pool, id, payload);
      if (name === "routingRules") return updateRoutingRule(pool, id, payload);
      throw new Error(`Unsupported collection: ${name}`);
    },
    async remove(name, id) {
      const table = {
        faqs: "faqs",
        branches: "branches",
        agents: "agents",
        routingRules: "routing_rules"
      }[name];
      if (!table) return false;
      await pool.query(`delete from ${table} where id = $1`, [id]);
      return true;
    },
    async createConversation(conversation) {
      const { rows } = await pool.query(
        `insert into conversations
          (channel, external_conversation_id, customer_name, customer_phone, status, detected_intent, marketplace, assigned_agent_id, metadata)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning *`,
        [
          conversation.channel,
          conversation.externalConversationId || null,
          conversation.customer,
          conversation.customerPhone || null,
          conversation.status,
          conversation.intent,
          conversation.marketplace,
          isUuid(conversation.assignedAgentId) ? conversation.assignedAgentId : null,
          { ...(conversation.metadata || {}), lastMessage: conversation.lastMessage }
        ]
      );
      await pool.query(
        `insert into messages (conversation_id, sender_type, body)
         values ($1, 'customer', $2)`,
        [rows[0].id, conversation.lastMessage]
      );
      await addConversationEvent(pool, rows[0].id, {
        eventType: "conversation.created",
        actorType: "system",
        body: `Conversacion creada en ${conversation.channel}`,
        metadata: { intent: conversation.intent, marketplace: conversation.marketplace, status: conversation.status }
      });
      return conversationFromRow({ ...rows[0], last_message: conversation.lastMessage });
    },
    async conversationById(id) {
      const { rows } = await pool.query("select * from conversations where id = $1", [id]);
      return rows[0] ? conversationFromRow(rows[0]) : null;
    },
    async activeConversationByExternalId(externalId, channel) {
      if (!externalId) return null;
      const { rows } = await pool.query(
        `select *
         from conversations
         where external_conversation_id = $1
           and channel = $2
           and status <> 'closed'
         order by updated_at desc
         limit 1`,
        [externalId, channel]
      );
      return rows[0] ? conversationFromRow(rows[0]) : null;
    },
    async updateConversationContext(id, payload) {
      const { rows } = await pool.query(
        `update conversations
         set customer_name = coalesce($2, customer_name),
             customer_phone = coalesce($3, customer_phone),
             external_conversation_id = coalesce($4, external_conversation_id),
             status = coalesce($5, status),
             detected_intent = coalesce($6, detected_intent),
             marketplace = coalesce($7, marketplace),
             assigned_agent_id = coalesce($8, assigned_agent_id),
             metadata = metadata || $9,
             updated_at = now()
         where id = $1
         returning *`,
        [
          id,
          payload.customer || null,
          payload.customerPhone || null,
          payload.externalConversationId || null,
          payload.status || null,
          payload.intent || null,
          payload.marketplace || null,
          isUuid(payload.assignedAgentId) ? payload.assignedAgentId : null,
          payload.metadata || {}
        ]
      );
      return rows[0] ? conversationFromRow(rows[0]) : null;
    },
    async messages(conversationId) {
      const { rows } = await pool.query(
        "select * from messages where conversation_id = $1 order by created_at asc",
        [conversationId]
      );
      return rows.map(messageFromRow);
    },
    async events(conversationId) {
      const { rows } = await pool.query(
        "select * from conversation_events where conversation_id = $1 order by created_at asc",
        [conversationId]
      );
      return rows.map(eventFromRow);
    },
    async addEvent(conversationId, payload) {
      return addConversationEvent(pool, conversationId, payload);
    },
    async addMessage(conversationId, payload) {
      const { rows } = await pool.query(
        `insert into messages (conversation_id, sender_type, sender_id, body, metadata)
         values ($1, $2, $3, $4, $5) returning *`,
        [
          conversationId,
          payload.senderType || "agent",
          isUuid(payload.senderId) ? payload.senderId : null,
          payload.body || "",
          payload.metadata || {}
        ]
      );
      await pool.query("update conversations set updated_at = now(), metadata = metadata || $2 where id = $1", [
        conversationId,
        { lastMessage: payload.body || "" }
      ]);
      await addConversationEvent(pool, conversationId, {
        eventType: "message.created",
        actorType: payload.senderType || "agent",
        actorId: payload.senderId || null,
        body: `Mensaje ${payload.senderType || "agent"} agregado`,
        metadata: { preview: (payload.body || "").slice(0, 120) }
      });
      return messageFromRow(rows[0]);
    },
    async updateConversationStatus(id, status) {
      const previous = await pool.query("select status from conversations where id = $1", [id]);
      const previousStatus = previous.rows[0]?.status || null;
      const { rows } = await pool.query(
        "update conversations set status = $2, updated_at = now() where id = $1 returning *",
        [id, status]
      );
      if (rows[0]) {
        await addConversationEvent(pool, id, {
          eventType: "conversation.status_changed",
          actorType: "system",
          body: `Estado cambiado de ${previousStatus || "sin estado"} a ${status}`,
          metadata: { previousStatus, status }
        });
      }
      return rows[0] ? conversationFromRow(rows[0]) : null;
    },
    async integrations() {
      const { rows } = await pool.query(`
        select distinct on (provider, lower(name)) *
        from integration_accounts
        order by provider, lower(name), created_at desc
      `);
      return rows.map(integrationFromRow);
    },
    async saveIntegration(payload) {
      const config = parseConfig(payload.config);
      const active = Boolean(payload.active ?? true);
      if (payload.id) {
        const { rows } = await pool.query(
          `update integration_accounts
           set provider=$2,
               name=$3,
               encrypted_config=case when $4::jsonb = '{}'::jsonb then encrypted_config else encrypted_config || $4::jsonb end,
               is_active=$5
           where id=$1 returning *`,
          [payload.id, payload.provider, payload.name, config, active]
        );
        return rows[0] ? integrationFromRow(rows[0]) : null;
      }
      const existing = await pool.query(
        "select id from integration_accounts where provider=$1 and lower(name)=lower($2) order by created_at desc limit 1",
        [payload.provider, payload.name]
      );
      if (existing.rows[0]) {
        const { rows } = await pool.query(
          `update integration_accounts
           set encrypted_config=case when $2::jsonb = '{}'::jsonb then encrypted_config else encrypted_config || $2::jsonb end,
               is_active=$3
           where id=$1 returning *`,
          [existing.rows[0].id, config, active]
        );
        await pool.query(
          "update integration_accounts set is_active=false where provider=$1 and lower(name)=lower($2) and id <> $3",
          [payload.provider, payload.name, existing.rows[0].id]
        );
        return rows[0] ? integrationFromRow(rows[0]) : null;
      }
      const { rows } = await pool.query(
        `insert into integration_accounts (provider, name, encrypted_config, is_active)
         values ($1, $2, $3, $4) returning *`,
        [payload.provider, payload.name, config, active]
      );
      return integrationFromRow(rows[0]);
    },
    async integrationById(id) {
      const { rows } = await pool.query("select * from integration_accounts where id=$1", [id]);
      const row = rows[0];
      if (!row) return null;
      return {
        ...integrationFromRow(row),
        config: row.encrypted_config || {}
      };
    },
    async recordIntegrationCheck(id, result) {
      const { rows } = await pool.query(
        `update integration_accounts
         set last_checked_at=now(),
             last_check_status=$2,
             last_check_message=$3
         where id=$1
         returning *`,
        [id, result.ok ? "ok" : "error", result.message]
      );
      return rows[0] ? integrationFromRow(rows[0]) : null;
    },
    async deleteIntegration(id) {
      const { rowCount } = await pool.query("delete from integration_accounts where id=$1", [id]);
      return rowCount > 0;
    },
    async integrationConfig(provider) {
      const { rows } = await pool.query(
        "select encrypted_config from integration_accounts where provider = $1 and is_active = true order by created_at desc limit 1",
        [provider]
      );
      return rows[0]?.encrypted_config || null;
    },
    async authenticate(email, password) {
      const { rows } = await pool.query("select * from users where lower(email) = lower($1) and is_active = true", [
        email || ""
      ]);
      const user = rows[0];
      if (!user || !verifyPassword(password || "", user.password_hash)) return null;
      return publicUser(user);
    },
    async createSession(userId) {
      const session = {
        id: randomBytes(32).toString("hex"),
        userId,
        expiresAt: sessionExpiry()
      };
      await pool.query("insert into sessions (id, user_id, expires_at) values ($1, $2, $3)", [
        session.id,
        session.userId,
        session.expiresAt
      ]);
      return session;
    },
    async userFromSession(sessionId) {
      if (!sessionId) return null;
      const { rows } = await pool.query(
        `select u.*
         from sessions s
         join users u on u.id = s.user_id
         where s.id = $1 and s.expires_at > now() and u.is_active = true`,
        [sessionId]
      );
      return publicUser(rows[0]);
    },
    async deleteSession(sessionId) {
      if (sessionId) await pool.query("delete from sessions where id = $1", [sessionId]);
    },
    async users() {
      const { rows } = await pool.query(
        "select id, name, email, role, agent_id, is_active, created_at from users order by created_at desc"
      );
      return rows.map(publicUser);
    },
    async saveUser(payload) {
      const item = normalizeUserPayload(payload);
      if (item.id) {
        const params = [item.id, item.name, item.email, item.role, isUuid(item.agentId) ? item.agentId : null, item.isActive];
        const passwordSql = item.password ? ", password_hash=$7" : "";
        if (item.password) params.push(hashPassword(item.password));
        const { rows } = await pool.query(
          `update users set name=$2, email=lower($3), role=$4, agent_id=$5, is_active=$6${passwordSql}
           where id=$1 returning id, name, email, role, agent_id, is_active, created_at`,
          params
        );
        return rows[0] ? publicUser(rows[0]) : null;
      }
      const { rows } = await pool.query(
        `insert into users (name, email, password_hash, role, agent_id, is_active)
         values ($1, lower($2), $3, $4, $5, $6)
         returning id, name, email, role, agent_id, is_active, created_at`,
        [
          item.name,
          item.email,
          hashPassword(item.password || randomBytes(12).toString("hex")),
          item.role,
          isUuid(item.agentId) ? item.agentId : null,
          item.isActive
        ]
      );
      return publicUser(rows[0]);
    },
    async updatePassword(userId, password) {
      const { rows } = await pool.query(
        `update users set password_hash=$2 where id=$1 returning id, name, email, role, agent_id, is_active, created_at`,
        [userId, hashPassword(password)]
      );
      return rows[0] ? publicUser(rows[0]) : null;
    }
  };
}

function normalizePayload(name, payload) {
  if (name === "faqs") {
    return {
      question: payload.question || "",
      shortAnswer: payload.shortAnswer || payload.short_answer || "",
      longAnswer: payload.longAnswer || payload.long_answer || "",
      category: payload.category || "General",
      tags: csv(payload.tags),
      published: Boolean(payload.published ?? payload.is_published ?? true)
    };
  }
  if (name === "branches") {
    return {
      name: payload.name || "",
      city: payload.city || "",
      phone: payload.phone || "",
      whatsapp: payload.whatsapp || "",
      address: payload.address || "",
      services: csv(payload.services),
      wholesaleContact: payload.wholesaleContact || payload.wholesale_contact || "",
      hours: payload.hours || ""
    };
  }
  if (name === "agents") {
    return {
      name: payload.name || "",
      role: payload.role || "agent",
      skills: csv(payload.skills),
      channels: csv(payload.channels),
      online: Boolean(payload.online),
      activeConversations: Number(payload.activeConversations || 0),
      maxConversations: Number(payload.maxConversations || 5)
    };
  }
  if (name === "routingRules") {
    return {
      name: payload.name || "",
      priority: Number(payload.priority || 100),
      channel: payload.channel || null,
      marketplace: payload.marketplace || null,
      intent: payload.intent || "faq",
      requiredSkill: payload.requiredSkill || payload.required_skill || null,
      botAllowed: Boolean(payload.botAllowed ?? payload.bot_allowed),
      fallbackMessage: payload.fallbackMessage || payload.fallback_message || ""
    };
  }
  return payload;
}

function normalizeUserPayload(payload) {
  return {
    id: payload.id || null,
    name: payload.name || "",
    email: String(payload.email || "").toLowerCase(),
    role: payload.role || "viewer",
    agentId: payload.agentId || payload.agent_id || null,
    isActive: Boolean(payload.isActive ?? payload.is_active ?? true),
    password: payload.password || ""
  };
}

async function createFaq(pool, payload) {
  const item = normalizePayload("faqs", payload);
  const { rows } = await pool.query(
    `insert into faqs (question, short_answer, long_answer, category, tags, is_published)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [item.question, item.shortAnswer, item.longAnswer, item.category, item.tags, item.published]
  );
  return faqFromRow(rows[0]);
}

async function updateFaq(pool, id, payload) {
  const item = normalizePayload("faqs", payload);
  const { rows } = await pool.query(
    `update faqs set question=$2, short_answer=$3, long_answer=$4, category=$5, tags=$6,
      is_published=$7, updated_at=now() where id=$1 returning *`,
    [id, item.question, item.shortAnswer, item.longAnswer, item.category, item.tags, item.published]
  );
  return rows[0] ? faqFromRow(rows[0]) : null;
}

async function createBranch(pool, payload) {
  const item = normalizePayload("branches", payload);
  const { rows } = await pool.query(
    `insert into branches (name, city, phone, whatsapp, address, business_hours, services, wholesale_contact)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [item.name, item.city, item.phone, item.whatsapp, item.address, { label: item.hours }, item.services, item.wholesaleContact]
  );
  return branchFromRow(rows[0]);
}

async function updateBranch(pool, id, payload) {
  const item = normalizePayload("branches", payload);
  const { rows } = await pool.query(
    `update branches set name=$2, city=$3, phone=$4, whatsapp=$5, address=$6,
      business_hours=$7, services=$8, wholesale_contact=$9 where id=$1 returning *`,
    [id, item.name, item.city, item.phone, item.whatsapp, item.address, { label: item.hours }, item.services, item.wholesaleContact]
  );
  return rows[0] ? branchFromRow(rows[0]) : null;
}

async function createAgent(pool, payload) {
  const item = normalizePayload("agents", payload);
  const email = `${Date.now()}-${item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@hwhub.local`;
  const { rows } = await pool.query(
    `insert into agents (name, email, role, skills, channels, is_online, active_conversations, max_conversations)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [item.name, email, item.role, item.skills, item.channels, item.online, item.activeConversations, item.maxConversations]
  );
  return agentFromRow(rows[0]);
}

async function updateAgent(pool, id, payload) {
  const item = normalizePayload("agents", payload);
  const { rows } = await pool.query(
    `update agents set name=$2, role=$3, skills=$4, channels=$5, is_online=$6,
      active_conversations=$7, max_conversations=$8 where id=$1 returning *`,
    [id, item.name, item.role, item.skills, item.channels, item.online, item.activeConversations, item.maxConversations]
  );
  return rows[0] ? agentFromRow(rows[0]) : null;
}

async function createRoutingRule(pool, payload) {
  const item = normalizePayload("routingRules", payload);
  const { rows } = await pool.query(
    `insert into routing_rules
      (name, priority, channel, marketplace, intent, required_skill, bot_allowed, fallback_message)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning *`,
    [item.name, item.priority, item.channel, item.marketplace, item.intent, item.requiredSkill, item.botAllowed, item.fallbackMessage]
  );
  return ruleFromRow(rows[0]);
}

async function updateRoutingRule(pool, id, payload) {
  const item = normalizePayload("routingRules", payload);
  const { rows } = await pool.query(
    `update routing_rules set name=$2, priority=$3, channel=$4, marketplace=$5, intent=$6,
      required_skill=$7, bot_allowed=$8, fallback_message=$9 where id=$1 returning *`,
    [id, item.name, item.priority, item.channel, item.marketplace, item.intent, item.requiredSkill, item.botAllowed, item.fallbackMessage]
  );
  return rows[0] ? ruleFromRow(rows[0]) : null;
}

async function addConversationEvent(pool, conversationId, payload) {
  const { rows } = await pool.query(
    `insert into conversation_events (conversation_id, event_type, actor_type, actor_id, body, metadata)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [
      conversationId,
      payload.eventType || "system.note",
      payload.actorType || "system",
      isUuid(payload.actorId) ? payload.actorId : null,
      payload.body || "",
      payload.metadata || {}
    ]
  );
  return eventFromRow(rows[0]);
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value || "");
}

function parseConfig(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      const error = new Error("Integration config must be a JSON object");
      error.statusCode = 400;
      throw error;
    }
    return parsed;
  } catch {
    const error = new Error("Integration config must be valid JSON");
    error.statusCode = 400;
    throw error;
  }
}

function maskConfig(config) {
  return Object.fromEntries(
    Object.entries(config || {}).map(([key, value]) => {
      if (!value) return [key, ""];
      const text = String(value);
      if (text.length <= 8) return [key, "********"];
      return [key, `${text.slice(0, 4)}...${text.slice(-4)}`];
    })
  );
}
