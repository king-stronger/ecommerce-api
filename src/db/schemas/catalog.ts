import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	boolean,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import type { ProductImage } from "./shared.js";

export const categories = pgTable(
	"categories",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		description: text("description"),
		image: text("image"),
		parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
			onDelete: "set null",
		}),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("categories_slug_unique").on(table.slug),
		index("categories_parent_id_idx").on(table.parentId),
	],
);

export const productStatusEnum = pgEnum("product_status", [
	"draft",
	"active",
	"archived",
]);

export const products = pgTable(
	"products",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		slug: text("slug").notNull(),
		description: text("description"),
		shortDescription: text("short_description"),
		status: productStatusEnum("status").notNull().default("draft"),
		images: jsonb("images").$type<ProductImage[]>().default([]).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("products_slug_unique").on(table.slug),
		index("products_status_idx").on(table.status),
	],
);

export const productCategories = pgTable(
	"product_categories",
	{
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		categoryId: uuid("category_id")
			.notNull()
			.references(() => categories.id, { onDelete: "cascade" }),
	},
	(table) => [
		primaryKey({
			name: "product_categories_pk",
			columns: [table.productId, table.categoryId],
		}),
		index("product_categories_category_id_idx").on(table.categoryId),
	],
);

export const productVariants = pgTable(
	"product_variants",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		productId: uuid("product_id")
			.notNull()
			.references(() => products.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sku: text("sku"),
		price: integer("price").notNull(),
		compareAtPrice: integer("compare_at_price"),
		stockQuantity: integer("stock_quantity").notNull().default(0),
		trackInventory: boolean("track_inventory").notNull().default(true),
		weight: integer("weight"),
		// Example: { color: "Black", size: "M" }
		options: jsonb("options").$type<Record<string, string>>(),
		images: jsonb("images").$type<ProductImage[]>().default([]).notNull(),
		isDefault: boolean("is_default").notNull().default(false),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("product_variants_product_id_idx").on(table.productId),
		uniqueIndex("product_variants_sku_unique")
			.on(table.sku)
			.where(sql`${table.sku} is not null`),
	],
);
