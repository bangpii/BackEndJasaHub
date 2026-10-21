import type { PoolClient } from 'pg';
import { SEED_CHAT_KNOWLEDGE } from '../seeds/chat.knowledge';

/**
 * 0008_seed_chat_knowledge
 *
 * Menyinkronkan basis pengetahuan bot dengan `seeds/chat.knowledge.ts`.
 * Idempoten: pertanyaan baru ditambahkan, pertanyaan lama diperbarui
 * (jawaban, kata kunci, dan indeks pencarian) tanpa menghapus data lain.
 */
export default {
  async up(client: PoolClient): Promise<void> {
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
        ON CONFLICT (lower(question)) DO UPDATE SET
          category   = EXCLUDED.category,
          answer     = EXCLUDED.answer,
          keywords   = EXCLUDED.keywords,
          lang       = EXCLUDED.lang,
          search_tsv = EXCLUDED.search_tsv
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
    await client.query('DELETE FROM chat_knowledge');
  },
};
