import asyncpg
from config import DATABASE_URL

_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL)
    return _pool

async def init_db():
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'viewer',
                created_at TIMESTAMPTZ DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS sessions (
                session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                filename TEXT NOT NULL,
                uploaded_by INTEGER REFERENCES users(user_id),
                upload_time TIMESTAMPTZ DEFAULT NOW(),
                sha256_hash CHAR(64),
                packet_count INTEGER DEFAULT 0,
                anomaly_score FLOAT,
                threat_score INTEGER DEFAULT 0,
                status TEXT DEFAULT 'processing'
            );

            CREATE TABLE IF NOT EXISTS alerts (
                alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                session_id UUID REFERENCES sessions(session_id),
                rule_name TEXT NOT NULL,
                severity TEXT NOT NULL,
                src_ip TEXT,
                dst_ip TEXT,
                description TEXT,
                fired_at TIMESTAMPTZ DEFAULT NOW(),
                case_id UUID
            );

            CREATE TABLE IF NOT EXISTS cases (
                case_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                title TEXT NOT NULL,
                assigned_to INTEGER REFERENCES users(user_id),
                status TEXT DEFAULT 'open',
                created_at TIMESTAMPTZ DEFAULT NOW(),
                notes TEXT DEFAULT '',
                evidence_refs TEXT[] DEFAULT '{}'
            );

            CREATE TABLE IF NOT EXISTS custody_log (
                log_id SERIAL PRIMARY KEY,
                session_id UUID,
                user_id INTEGER,
                action TEXT NOT NULL,
                accessed_at TIMESTAMPTZ DEFAULT NOW(),
                ip_address TEXT
            );

            CREATE TABLE IF NOT EXISTS siem_config (
                id SERIAL PRIMARY KEY,
                is_enabled BOOLEAN DEFAULT FALSE,
                destination_url TEXT,
                destination_type TEXT,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );

            ALTER TABLE sessions ADD COLUMN IF NOT EXISTS threat_score INTEGER DEFAULT 0;

            INSERT INTO users (username, password_hash, role)
            VALUES 
                ('admin', '$2b$12$placeholder', 'admin'),
                ('investigator', '$2b$12$placeholder', 'investigator'),
                ('viewer', '$2b$12$placeholder', 'viewer')
            ON CONFLICT (username) DO NOTHING;
        """)
    print("[DB] PostgreSQL schema initialized")
