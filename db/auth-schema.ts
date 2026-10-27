import {sqliteTable,text,integer,index,uniqueIndex} from 'drizzle-orm/sqlite-core';
export const users=sqliteTable('users',{
 id:text('id').primaryKey(),email:text('email').notNull(),name:text('name').notNull(),role:text('role').notNull().default('member'),passwordHash:text('password_hash').notNull(),active:integer('active',{mode:'boolean'}).notNull().default(true),mustChangePassword:integer('must_change_password',{mode:'boolean'}).notNull().default(true),failedAttempts:integer('failed_attempts').notNull().default(0),lockedUntil:text('locked_until'),lastLoginAt:text('last_login_at'),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
},t=>[uniqueIndex('users_email_unique').on(t.email)]);
export const sessions=sqliteTable('sessions',{
 hash:text('hash').primaryKey(),userId:text('user_id').notNull().references(()=>users.id),createdAt:text('created_at').notNull(),lastSeenAt:text('last_seen_at').notNull(),expiresAt:text('expires_at').notNull(),
},t=>[index('sessions_user').on(t.userId)]);
