import {
	boolean,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export const shippingMethods = pgTable(
	"shipping_methods",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		name: text("name").notNull(),
		description: text("description"),
		price: integer("price").notNull(),
		currency: text("currency").notNull(),
		estimatedMinDays: integer("estimated_min_days"),
		estimatedMaxDays: integer("estimated_max_days"),
		isActive: boolean("is_active").notNull().default(true),
		sortOrder: integer("sort_order").notNull().default(0),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("shipping_methods_active_idx").on(table.isActive, table.sortOrder),
	],
);
