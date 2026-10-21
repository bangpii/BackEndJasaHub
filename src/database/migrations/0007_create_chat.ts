import type { PoolClient } from 'pg';
import { SEED_CHAT_KNOWLEDGE } from '../seeds/chat.knowledge';

/**
 * 0007_create_chat
 *
 * Membuat tabel untuk fitur chat bot pelanggan:
 *
 *  - `chat_messages`
 *      Riwayat percakapan bot per pelanggan. Dihapus otomatis setelah 24 jam
 *      (pembersihan lazy di service, bukan cron, agar aman di serverless).
 *
 *  - `chat_knowledge`
 *      Basis pengetahuan bot (Q&A). Pencarian memakai PostgreSQL full-text
 *      search bahasa Indonesia + trigram similarity + kecocokan kata kunci.
 *      Diisi idempoten dari `database/seeds/chat.knowledge.ts`.
 */
export default {
  async up(client: PoolClient): Promise<void> {
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          BIGSERIAL PRIMARY KEY,
        user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender      VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'bot')),
        content     TEXT NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created
        ON chat_messages (user_id, created_at)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_messages_created
        ON chat_messages (created_at)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_knowledge (
        id          BIGSERIAL PRIMARY KEY,
        category    VARCHAR(40) NOT NULL,
        question    TEXT NOT NULL,
        answer      TEXT NOT NULL,
        keywords    TEXT[] NOT NULL DEFAULT '{}',
        lang        VARCHAR(5) NOT NULL DEFAULT 'id',
        search_tsv  TSVECTOR NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_knowledge_question_unique
        ON chat_knowledge (lower(question))
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_knowledge_search
        ON chat_knowledge USING GIN (search_tsv)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_knowledge_question_trgm
        ON chat_knowledge USING GIN (question gin_trgm_ops)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_chat_knowledge_category
        ON chat_knowledge (category)
    `);

    for (const entry of SEED_CHAT_KNOWLEDGE) {
      const searchText = [
        entry.question,
        entry.answer,
        entry.keywords.join(' '),
      ].join(' ');

      await client.query(
        `
        INSERT INTO chat_knowledge
          (category, question, answer, keywords, lang, search_tsv)
        VALUES ($1, $2, $3, $4, $5, to_tsvector('indonesian', $6))
        ON CONFLICT (lower(question)) DO NOTHING
        `,
        [
          entry.category,
          entry.question,
          entry.answer,
          entry.keywords,
          entry.lang,
          searchText,
        ],
      );
    }
  },

  async down(client: PoolClient): Promise<void> {
    await client.query('DROP TABLE IF EXISTS chat_messages');
    await client.query('DROP TABLE IF EXISTS chat_knowledge');
  },
};
