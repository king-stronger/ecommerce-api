import {
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { productVariants } from "./catalog.js";
import { customers } from "./customer.js";

export const carts = pgTable(
	"carts",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		customerId: uuid("customer_id").references(() => customers.id, {
			onDelete: "set null",
		}),
		// Guest carts are keyed by browser/session id
		sessionId: text("session_id"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("carts_customer_id_idx").on(table.customerId),
		uniqueIndex("carts_session_id_unique").on(table.sessionId),
	],
);

export const cartItems = pgTable(
	"cart_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		cartId: uuid("cart_id")
			.notNull()
			.references(() => carts.id, { onDelete: "cascade" }),
		productVariantId: uuid("product_variant_id")
			.notNull()
			.references(() => productVariants.id, { onDelete: "cascade" }),
		quantity: integer("quantity").notNull().default(1),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("cart_items_cart_variant_unique").on(
			table.cartId,
			table.productVariantId,
		),
		index("cart_items_variant_id_idx").on(table.productVariantId),
	],
);
