import {
	boolean,
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const couponTypeEnum = pgEnum("coupon_type", ["percentage", "fixed"]);

export const coupons = pgTable(
	"coupons",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		code: text("code").notNull(),
		type: couponTypeEnum("type").notNull(),
		// percentage: 10 = 10%; fixed: amount in minor units
		value: integer("value").notNull(),
		minOrderAmount: integer("min_order_amount"),
		maxDiscountAmount: integer("max_discount_amount"),
		usageLimit: integer("usage_limit"),
		usedCount: integer("used_count").notNull().default(0),
		startsAt: timestamp("starts_at", { withTimezone: true }),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		isActive: boolean("is_active").notNull().default(true),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("coupons_code_unique").on(table.code),
		index("coupons_active_idx").on(table.isActive),
		index("coupons_expires_at_idx").on(table.expiresAt),
	],
);
