import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth.js";

export const customers = pgTable(
	"customers",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		// Better Auth user id — nullable for guest checkout
		userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
		email: text("email").notNull(),
		firstName: text("first_name").notNull(),
		lastName: text("last_name"),
		phone: text("phone"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("customers_user_id_unique").on(table.userId),
		index("customers_email_idx").on(table.email),
	],
);

export const addresses = pgTable(
	"addresses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		customerId: uuid("customer_id")
			.notNull()
			.references(() => customers.id, { onDelete: "cascade" }),
		label: text("label"),
		firstName: text("first_name").notNull(),
		lastName: text("last_name"),
		company: text("company"),
		phone: text("phone"),
		addressLine1: text("address_line1").notNull(),
		addressLine2: text("address_line2"),
		city: text("city").notNull(),
		state: text("state").notNull(),
		postalCode: text("postal_code").notNull(),
		country: text("country").notNull(),
		isDefault: boolean("is_default").notNull().default(false),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [index("addresses_customer_id_idx").on(table.customerId)],
);
