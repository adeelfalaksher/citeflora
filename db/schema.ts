import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: text("id").primaryKey(), createdAt: text("created_at").notNull(),
});
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at").notNull(),
}, t => [index("sessions_workspace_idx").on(t.workspaceId)]);
export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(), doi: text("doi").notNull().default(""), contentHash: text("content_hash").notNull(),
  payload: text("payload").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("sources_workspace_idx").on(t.workspaceId), uniqueIndex("sources_content_unique").on(t.workspaceId, t.contentHash)]);
export const claims = sqliteTable("claims", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  sourceId: text("source_id").notNull().references(() => sources.id, { onDelete: "cascade" }), payload: text("payload").notNull(),
  status: text("status").notNull().default("pending"), reviewerNote: text("reviewer_note").notNull().default(""),
  revision: integer("revision").notNull().default(0), updatedAt: text("updated_at").notNull(),
}, t => [index("claims_workspace_idx").on(t.workspaceId), index("claims_source_idx").on(t.sourceId)]);
export const audit = sqliteTable("audit", {
  id: text("id").primaryKey(), workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  claimId: text("claim_id"), sourceId: text("source_id"), action: text("action").notNull(), detail: text("detail").notNull(), createdAt: text("created_at").notNull(),
}, t => [index("audit_workspace_idx").on(t.workspaceId)]);
export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(), count: integer("count").notNull(), expiresAt: integer("expires_at").notNull(),
});
