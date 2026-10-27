import { pgTable, text, integer, primaryKey } from 'drizzle-orm/pg-core';
export const clients = pgTable('clients', {
    id: text('id').primaryKey(), name: text('name').notNull(), brand: text('brand').notNull(),
    revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
});
export const documents = pgTable('documents', {
    id: text('id').primaryKey(), clientId: text('client_id').notNull().references(() => clients.id),
    title: text('title').notNull(), kind: text('kind').notNull(), content: text('content').notNull(),
    revision: integer('revision').notNull().default(1), updatedAt: text('updated_at').notNull(),
});
export const componentVersions = pgTable('component_versions', {
    id: text('id').notNull(), version: integer('version').notNull(), clientId: text('client_id').references(() => clients.id),
    name: text('name').notNull(), content: text('content').notNull(), createdAt: text('created_at').notNull(),
}, t => [primaryKey({ columns: [t.id, t.version] })]);
export const assets = pgTable('assets', {
    id: text('id').primaryKey(), clientId: text('client_id').notNull().references(() => clients.id),
    name: text('name').notNull(), url: text('url').notNull(), createdAt: text('created_at').notNull(),
});
export const sharedAssets = pgTable('shared_assets', {
    id: text('id').primaryKey(), name: text('name').notNull(),
    url: text('url').notNull(), createdAt: text('created_at').notNull(),
});
export const templateVersions = pgTable('template_versions', {
    id: text('id').notNull(), version: integer('version').notNull(),
    clientId: text('client_id').references(() => clients.id), name: text('name').notNull(),
    content: text('content').notNull(), metadata: text('metadata').notNull(),
    previewBrand: text('preview_brand').notNull(), createdAt: text('created_at').notNull(),
}, t => [primaryKey({ columns: [t.id, t.version] })]);
