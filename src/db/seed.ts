/**
 * Demo seed for local / portfolio use. Idempotent by slug / code / email.
 * Run: pnpm db:seed
 */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { eq } from "drizzle-orm";
import { createAuth } from "../lib/auth.js";
import { envSchema } from "../lib/env.js";
import { createDb } from "./db.js";
import {
	categories,
	coupons,
	productCategories,
	products,
	productVariants,
	shippingMethods,
	user,
} from "./schema.js";

expand(config({ override: true }));

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
	throw new Error(`Invalid environment for seed: ${parsed.error.message}`);
}

const env = parsed.data as Env;
const db = createDb(env);
const auth = createAuth(env, db);

const ADMIN_EMAIL =
	process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || "admin@example.com";
const ADMIN_PASSWORD =
	process.env.SEED_ADMIN_PASSWORD?.trim() || "adminadmin123";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME?.trim() || "Demo Admin";

const img = (label: string) =>
	`https://placehold.co/800x800/1a1a1a/f5f5f5/png?text=${encodeURIComponent(label)}`;

async function ensureCategory(input: {
	name: string;
	slug: string;
	description: string;
	sortOrder: number;
}) {
	const [existing] = await db
		.select()
		.from(categories)
		.where(eq(categories.slug, input.slug))
		.limit(1);
	if (existing) {
		return existing;
	}
	const [row] = await db
		.insert(categories)
		.values({
			...input,
			isActive: true,
		})
		.returning();
	console.log(`  + category ${row.slug}`);
	return row;
}

async function ensureProduct(input: {
	name: string;
	slug: string;
	description: string;
	shortDescription: string;
	images: { url: string; alt: string; sort: number }[];
	categoryIds: string[];
	variants: Array<{
		name: string;
		sku: string;
		price: number;
		compareAtPrice?: number | null;
		stockQuantity: number;
		options: Record<string, string>;
		isDefault: boolean;
	}>;
}) {
	const [existing] = await db
		.select()
		.from(products)
		.where(eq(products.slug, input.slug))
		.limit(1);

	if (existing) {
		return existing;
	}

	const [product] = await db
		.insert(products)
		.values({
			name: input.name,
			slug: input.slug,
			description: input.description,
			shortDescription: input.shortDescription,
			status: "active",
			images: input.images,
		})
		.returning();

	if (input.categoryIds.length > 0) {
		await db.insert(productCategories).values(
			input.categoryIds.map((categoryId) => ({
				productId: product.id,
				categoryId,
			})),
		);
	}

	await db.insert(productVariants).values(
		input.variants.map((variant) => ({
			productId: product.id,
			name: variant.name,
			sku: variant.sku,
			price: variant.price,
			compareAtPrice: variant.compareAtPrice ?? null,
			stockQuantity: variant.stockQuantity,
			trackInventory: true,
			options: variant.options,
			images: [],
			isDefault: variant.isDefault,
			isActive: true,
		})),
	);

	console.log(`  + product ${product.slug}`);
	return product;
}

async function ensureShippingMethod(input: {
	name: string;
	description: string;
	price: number;
	currency: string;
	estimatedMinDays: number;
	estimatedMaxDays: number;
	sortOrder: number;
}) {
	const [existing] = await db
		.select()
		.from(shippingMethods)
		.where(eq(shippingMethods.name, input.name))
		.limit(1);
	if (existing) {
		return existing;
	}
	const [row] = await db
		.insert(shippingMethods)
		.values({ ...input, isActive: true })
		.returning();
	console.log(`  + shipping ${row.name}`);
	return row;
}

async function ensureCoupon(input: {
	code: string;
	type: "percentage" | "fixed";
	value: number;
	minOrderAmount: number | null;
	maxDiscountAmount: number | null;
}) {
	const [existing] = await db
		.select()
		.from(coupons)
		.where(eq(coupons.code, input.code))
		.limit(1);
	if (existing) {
		return existing;
	}
	const [row] = await db
		.insert(coupons)
		.values({
			...input,
			usageLimit: null,
			usedCount: 0,
			startsAt: null,
			expiresAt: null,
			isActive: true,
		})
		.returning();
	console.log(`  + coupon ${row.code}`);
	return row;
}

async function ensureAdminUser() {
	const [existing] = await db
		.select({ id: user.id, email: user.email, role: user.role })
		.from(user)
		.where(eq(user.email, ADMIN_EMAIL))
		.limit(1);

	if (existing) {
		if (existing.role !== "admin") {
			await db
				.update(user)
				.set({ role: "admin" })
				.where(eq(user.id, existing.id));
			console.log(`  ~ promoted ${existing.email} to admin`);
		} else {
			console.log(`  = admin ${existing.email} already exists`);
		}
		return;
	}

	await auth.api.createUser({
		body: {
			email: ADMIN_EMAIL,
			password: ADMIN_PASSWORD,
			name: ADMIN_NAME,
			role: "admin",
		},
	});
	console.log(`  + admin ${ADMIN_EMAIL}`);
}

async function main() {
	console.log("Seeding demo data…");

	const apparel = await ensureCategory({
		name: "Apparel",
		slug: "apparel",
		description: "Everyday wear for the storefront demo.",
		sortOrder: 0,
	});
	const accessories = await ensureCategory({
		name: "Accessories",
		slug: "accessories",
		description: "Small add-ons that pair with apparel.",
		sortOrder: 1,
	});

	await ensureProduct({
		name: "Classic Tee",
		slug: "classic-tee",
		description:
			"A midweight cotton tee with a clean cut. Seeded for catalog and cart demos.",
		shortDescription: "Midweight cotton tee",
		images: [{ url: img("Classic Tee"), alt: "Classic Tee", sort: 0 }],
		categoryIds: [apparel.id],
		variants: [
			{
				name: "Black / S",
				sku: "TEE-BLK-S",
				price: 2900,
				compareAtPrice: 3500,
				stockQuantity: 25,
				options: { color: "Black", size: "S" },
				isDefault: true,
			},
			{
				name: "Black / M",
				sku: "TEE-BLK-M",
				price: 2900,
				compareAtPrice: 3500,
				stockQuantity: 40,
				options: { color: "Black", size: "M" },
				isDefault: false,
			},
			{
				name: "White / M",
				sku: "TEE-WHT-M",
				price: 2900,
				stockQuantity: 30,
				options: { color: "White", size: "M" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Everyday Cap",
		slug: "everyday-cap",
		description: "Structured cotton cap with an adjustable strap.",
		shortDescription: "Adjustable cotton cap",
		images: [{ url: img("Everyday Cap"), alt: "Everyday Cap", sort: 0 }],
		categoryIds: [accessories.id],
		variants: [
			{
				name: "One size / Navy",
				sku: "CAP-NVY-OS",
				price: 1900,
				stockQuantity: 50,
				options: { color: "Navy", size: "OS" },
				isDefault: true,
			},
		],
	});

	await ensureShippingMethod({
		name: "Standard",
		description: "Tracked delivery in 3–5 business days.",
		price: 499,
		currency: "EUR",
		estimatedMinDays: 3,
		estimatedMaxDays: 5,
		sortOrder: 0,
	});
	await ensureShippingMethod({
		name: "Express",
		description: "Priority delivery in 1–2 business days.",
		price: 999,
		currency: "EUR",
		estimatedMinDays: 1,
		estimatedMaxDays: 2,
		sortOrder: 1,
	});

	await ensureCoupon({
		code: "WELCOME10",
		type: "percentage",
		value: 10,
		minOrderAmount: 2000,
		maxDiscountAmount: 1500,
	});

	await ensureAdminUser();

	console.log("Seed complete.");
	console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
