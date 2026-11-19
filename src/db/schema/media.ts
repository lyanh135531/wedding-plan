import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core';
export const mediaLinks = pgTable('media_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(), url: text('url').notNull(), mediaType: text('media_type').notNull(), notes: text('notes'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
