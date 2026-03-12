-- ============================================================
-- TaskFlow — Supabase Schema
-- Paste toàn bộ file này vào: Dashboard → SQL Editor → Run
-- ============================================================


-- ── TABLES ───────────────────────────────────────────────────


CREATE TABLE goals (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title        TEXT        NOT NULL,
  category     TEXT        NOT NULL DEFAULT 'career',  -- career|finance|health|travel|learning
  status       TEXT        NOT NULL DEFAULT 'active',  -- active|done
  deadline     DATE,
  description  TEXT,
  progress     INT         NOT NULL DEFAULT 0,
  cover_emoji  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE tasks (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title             TEXT        NOT NULL,
  category          TEXT        NOT NULL DEFAULT 'adhoc',  -- work|personal|finance|adhoc
  priority          TEXT        NOT NULL DEFAULT 'p2',     -- p0|p1|p2|p3
  status            TEXT        NOT NULL DEFAULT 'todo',   -- todo|done
  deadline          DATE,
  goal_id           UUID        REFERENCES goals(id) ON DELETE SET NULL,
  notes             TEXT,
  estimated_minutes INT,
  recurring         TEXT,                                  -- daily|weekly|monthly|null
  checklist         JSONB,                                 -- [{id, text, done}]
  progress          INT         NOT NULL DEFAULT 0,
  done_at           TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE milestones (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_id    UUID        REFERENCES goals(id) ON DELETE CASCADE NOT NULL,
  title      TEXT        NOT NULL,
  status     TEXT        NOT NULL DEFAULT 'todo',  -- todo|done
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE resources (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  url             TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  summary         TEXT,
  tags            TEXT[]      DEFAULT '{}',
  reading_minutes INT,
  status          TEXT        NOT NULL DEFAULT 'toread',  -- toread|reading|done
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE focus_history (
  id       UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id  UUID  REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date     DATE  NOT NULL,
  task_ids UUID[] NOT NULL DEFAULT '{}',
  UNIQUE(user_id, date)
);

CREATE TABLE weekly_reviews (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start  DATE        NOT NULL,
  ai_summary  TEXT,
  data        JSONB,
  UNIQUE(user_id, week_start)
);

CREATE TABLE ideas (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content     TEXT        NOT NULL,
  category    TEXT        NOT NULL DEFAULT 'idea',    -- idea|note|goal|random|project
  status      TEXT        NOT NULL DEFAULT 'active',  -- active|archived
  pinned      BOOLEAN     NOT NULL DEFAULT FALSE,
  enrichment  JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_settings (
  user_id                 UUID    REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  telegram_token          TEXT,
  telegram_chat_id        TEXT,
  telegram_notify_done    BOOLEAN DEFAULT FALSE,
  telegram_notify_overdue BOOLEAN DEFAULT TRUE,
  claude_api_key          TEXT,
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_preferences (
  user_id        UUID    REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  ai_provider    TEXT    DEFAULT 'claude',   -- claude|gemini
  ai_model       TEXT,
  notify_done    BOOLEAN DEFAULT FALSE,
  notify_overdue BOOLEAN DEFAULT TRUE,
  auto_reminder  BOOLEAN DEFAULT TRUE,
  data           JSONB   DEFAULT '{}',       -- widgetLeft, widgetRight, priorityRules
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);


-- ── INDEXES ──────────────────────────────────────────────────


CREATE INDEX idx_tasks_user_status   ON tasks(user_id, status);
CREATE INDEX idx_tasks_user_deadline ON tasks(user_id, deadline);
CREATE INDEX idx_tasks_goal_id       ON tasks(goal_id);

CREATE INDEX idx_goals_user_status   ON goals(user_id, status);

CREATE INDEX idx_milestones_goal_id  ON milestones(goal_id);

CREATE INDEX idx_resources_user_status ON resources(user_id, status);

CREATE INDEX idx_ideas_user_pinned   ON ideas(user_id, pinned DESC, created_at DESC);


-- ── ROW LEVEL SECURITY ────────────────────────────────────────


ALTER TABLE tasks          ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones     ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE focus_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- tasks
CREATE POLICY "tasks_select" ON tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "tasks_insert" ON tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_update" ON tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "tasks_delete" ON tasks FOR DELETE USING (auth.uid() = user_id);

-- goals
CREATE POLICY "goals_select" ON goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "goals_insert" ON goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "goals_update" ON goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "goals_delete" ON goals FOR DELETE USING (auth.uid() = user_id);

-- milestones
CREATE POLICY "milestones_select" ON milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "milestones_insert" ON milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "milestones_update" ON milestones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "milestones_delete" ON milestones FOR DELETE USING (auth.uid() = user_id);

-- resources
CREATE POLICY "resources_select" ON resources FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "resources_insert" ON resources FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "resources_update" ON resources FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "resources_delete" ON resources FOR DELETE USING (auth.uid() = user_id);

-- focus_history
CREATE POLICY "focus_history_select" ON focus_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "focus_history_insert" ON focus_history FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "focus_history_update" ON focus_history FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "focus_history_delete" ON focus_history FOR DELETE USING (auth.uid() = user_id);

-- weekly_reviews
CREATE POLICY "weekly_reviews_select" ON weekly_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "weekly_reviews_insert" ON weekly_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "weekly_reviews_update" ON weekly_reviews FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "weekly_reviews_delete" ON weekly_reviews FOR DELETE USING (auth.uid() = user_id);

-- ideas
CREATE POLICY "ideas_select" ON ideas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ideas_insert" ON ideas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ideas_update" ON ideas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ideas_delete" ON ideas FOR DELETE USING (auth.uid() = user_id);

-- user_settings
CREATE POLICY "user_settings_select" ON user_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_settings_insert" ON user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_settings_update" ON user_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_settings_delete" ON user_settings FOR DELETE USING (auth.uid() = user_id);

-- user_preferences
CREATE POLICY "user_preferences_select" ON user_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_insert" ON user_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_preferences_update" ON user_preferences FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "user_preferences_delete" ON user_preferences FOR DELETE USING (auth.uid() = user_id);
