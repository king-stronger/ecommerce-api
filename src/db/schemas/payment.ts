import { sql } from "drizzle-orm";
import {
	index,
	integer,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { orders } from "./order.js";

export const paymentRecordStatusEnum = pgEnum("payment_record_status", [
	"pending",
	"processing",
	"succeeded",
	"failed",
	"cancelled",
	"refunded",
	"partially_refunded",
]);

export const payments = pgTable(
	"payments",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		// stripe, paystack, flutterwave, ...
		provider: text("provider").notNull(),
		// Provider-specific ID (set once the provider creates the charge)
		providerPaymentId: text("provider_payment_id"),
		status: paymentRecordStatusEnum("status").notNull().default("pending"),
		amount: integer("amount").notNull(),
		currency: text("currency").notNull(),
		// card, mobile_money, bank_transfer, ...
		paymentMethodType: text("payment_method_type"),
		paidAt: timestamp("paid_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		index("payments_order_id_idx").on(table.orderId),
		uniqueIndex("payments_provider_payment_unique")
			.on(table.provider, table.providerPaymentId)
			.where(sql`${table.providerPaymentId} is not null`),
		index("payments_status_idx").on(table.status),
	],
);
