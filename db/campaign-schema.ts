import {pgTable,text,integer,boolean,primaryKey,uniqueIndex,index} from 'drizzle-orm/pg-core';
import {clients,documents} from './schema';
export const contacts=pgTable('contacts',{
 clientId:text('client_id').notNull().references(()=>clients.id),email:text('email').notNull(),firstName:text('first_name').notNull().default(''),lastName:text('last_name').notNull().default(''),fields:text('fields').notNull().default('{}'),status:text('status').notNull().default('active'),updatedAt:text('updated_at').notNull(),
},t=>[primaryKey({columns:[t.clientId,t.email]})]);
export const audienceImports=pgTable('audience_imports',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),name:text('name').notNull(),fingerprint:text('fingerprint').notNull(),members:text('members').notNull(),stats:text('stats').notNull(),mapping:text('mapping').notNull(),kind:text('kind').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('audience_import_identity').on(t.clientId,t.fingerprint,t.kind)]);
export const campaignSettings=pgTable('campaign_settings',{
 clientId:text('client_id').primaryKey().references(()=>clients.id),senderName:text('sender_name').notNull().default(''),fromEmail:text('from_email').notNull().default(''),replyTo:text('reply_to').notNull().default(''),mapping:text('mapping').notNull().default('{}'),reportDelay:integer('report_delay').notNull().default(3),senderVerified:boolean('sender_verified').notNull().default(false),revision:integer('revision').notNull().default(1),updatedAt:text('updated_at').notNull(),
});
export const campaigns=pgTable('campaigns',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),documentId:text('document_id').references(()=>documents.id),name:text('name').notNull(),snapshot:text('snapshot').notNull(),audienceId:text('audience_id').references(()=>audienceImports.id),status:text('status').notNull().default('draft'),plannedAt:text('planned_at'),sentAt:text('sent_at'),revision:integer('revision').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull(),
});
export const campaignTests=pgTable('campaign_tests',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),campaignId:text('campaign_id').notNull().references(()=>campaigns.id),email:text('email').notNull(),sourceRevision:integer('source_revision').notNull(),sentBy:text('sent_by').notNull(),status:text('status').notNull(),error:text('error').notNull().default(''),providerMessageId:text('provider_message_id').notNull().default(''),createdAt:text('created_at').notNull(),
},t=>[index('campaign_test_recent').on(t.campaignId,t.createdAt)]);
export const campaignReports=pgTable('campaign_reports',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),campaignId:text('campaign_id').notNull().references(()=>campaigns.id),fingerprint:text('fingerprint').notNull(),source:text('source').notNull(),cutoff:text('cutoff').notNull(),timezone:text('timezone').notNull(),data:text('data').notNull(),createdAt:text('created_at').notNull(),
},t=>[uniqueIndex('campaign_report_identity').on(t.campaignId,t.fingerprint)]);
export const preferenceTokens=pgTable('preference_tokens',{
 hash:text('hash').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),email:text('email').notNull(),createdAt:text('created_at').notNull(),
});
export const clickTokens=pgTable('click_tokens',{
 hash:text('hash').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),campaignId:text('campaign_id').notNull().references(()=>campaigns.id),email:text('email').notNull(),linkId:text('link_id').notNull(),url:text('url').notNull(),isTest:integer('is_test').notNull().default(1),
});
export const campaignEvents=pgTable('campaign_events',{
 id:text('id').primaryKey(),clientId:text('client_id').notNull().references(()=>clients.id),campaignId:text('campaign_id').notNull().references(()=>campaigns.id),email:text('email').notNull(),event:text('event').notNull(),linkId:text('link_id'),url:text('url'),reason:text('reason'),timestamp:text('timestamp').notNull(),isTest:integer('is_test').notNull().default(0),
});
