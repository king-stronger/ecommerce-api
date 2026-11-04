import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { products, productVariants } from "./catalog.js";
import { coupons } from "./coupon.js";
import { customers } from "./customer.js";
import type { AddressSnapshot } from "./shared.js";
import { shippingMethods } from "./shipping.js";

export const orderStatusEnum = pgEnum("order_status", [
	"pending",
	"confirmed",
	"cancelled",
	"completed",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
	"pending",
	"paid",
	"failed",
	"refunded",
	"partially_refunded",
]);

export const fulfillmentStatusEnum = pgEnum("fulfillment_status", [
	"unfulfilled",
	"processing",
	"shipped",
	"delivered",
	"cancelled",
]);

export const orders = pgTable(
	"orders",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderNumber: text("order_number").notNull(),
		customerId: uuid("customer_id").references(() => customers.id, {
			onDelete: "set null",
		}),
		status: orderStatusEnum("status").notNull().default("pending"),
		paymentStatus: paymentStatusEnum("payment_status")
			.notNull()
			.default("pending"),
		fulfillmentStatus: fulfillmentStatusEnum("fulfillment_status")
			.notNull()
			.default("unfulfilled"),
		currency: text("currency").notNull(),
		subtotal: integer("subtotal").notNull(),
		discountAmount: integer("discount_amount").notNull().default(0),
		shippingAmount: integer("shipping_amount").notNull().default(0),
		taxAmount: integer("tax_amount").notNull().default(0),
		totalAmount: integer("total_amount").notNull(),
		couponId: uuid("coupon_id").references(() => coupons.id, {
			onDelete: "set null",
		}),
		customerEmail: text("customer_email").notNull(),
		customerPhone: text("customer_phone"),
		shippingAddress: jsonb("shipping_address")
			.$type<AddressSnapshot>()
			.notNull(),
		billingAddress: jsonb("billing_address").$type<AddressSnapshot>().notNull(),
		shippingMethodId: uuid("shipping_method_id").references(
			() => shippingMethods.id,
			{ onDelete: "set null" },
		),
		shippingMethodName: text("shipping_method_name"),
		trackingNumber: text("tracking_number"),
		notes: text("notes"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		uniqueIndex("orders_order_number_unique").on(table.orderNumber),
		index("orders_customer_id_idx").on(table.customerId),
		index("orders_status_idx").on(table.status),
		index("orders_payment_status_idx").on(table.paymentStatus),
		index("orders_created_at_idx").on(table.createdAt),
	],
);

export const orderItems = pgTable(
	"order_items",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		orderId: uuid("order_id")
			.notNull()
			.references(() => orders.id, { onDelete: "cascade" }),
		productId: uuid("product_id").references(() => products.id, {
			onDelete: "set null",
		}),
		productVariantId: uuid("product_variant_id").references(
			() => productVariants.id,
			{ onDelete: "set null" },
		),
		productName: text("product_name").notNull(),
		variantName: text("variant_name"),
		sku: text("sku"),
		unitPrice: integer("unit_price").notNull(),
		quantity: integer("quantity").notNull(),
		discountAmount: integer("discount_amount").notNull().default(0),
		totalAmount: integer("total_amount").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => [
		index("order_items_order_id_idx").on(table.orderId),
		index("order_items_product_id_idx").on(table.productId),
		index("order_items_variant_id_idx").on(table.productVariantId),
	],
);
