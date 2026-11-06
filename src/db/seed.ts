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

const photo = (id: string, alt: string) => ({
	url: `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`,
	alt,
	sort: 0,
});

async function ensureCategory(input: {
	name: string;
	slug: string;
	description: string;
	image: string;
	sortOrder: number;
}) {
	const [existing] = await db
		.select()
		.from(categories)
		.where(eq(categories.slug, input.slug))
		.limit(1);
	if (existing) {
		const [row] = await db
			.update(categories)
			.set({
				name: input.name,
				description: input.description,
				image: input.image,
				sortOrder: input.sortOrder,
			})
			.where(eq(categories.id, existing.id))
			.returning();
		console.log(`  ~ category ${row.slug}`);
		return row;
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
		await db
			.update(products)
			.set({
				name: input.name,
				description: input.description,
				shortDescription: input.shortDescription,
				images: input.images,
			})
			.where(eq(products.id, existing.id));
		console.log(`  ~ product ${existing.slug}`);
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

	await db
		.update(categories)
		.set({ isActive: false })
		.where(eq(categories.slug, "demo"));

	const apparel = await ensureCategory({
		name: "Vêtements",
		slug: "apparel",
		description: "Tees, pulls et vestes.",
		image:
			"https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1400&q=80",
		sortOrder: 0,
	});
	const shoes = await ensureCategory({
		name: "Chaussures",
		slug: "chaussures",
		description: "Baskets et sandales.",
		image:
			"https://images.unsplash.com/photo-1460353581641-37baddab0fa2?auto=format&fit=crop&w=1400&q=80",
		sortOrder: 1,
	});
	const bags = await ensureCategory({
		name: "Sacs",
		slug: "sacs",
		description: "Cabas et sacs à dos.",
		image:
			"https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=1400&q=80",
		sortOrder: 2,
	});
	const accessories = await ensureCategory({
		name: "Accessoires",
		slug: "accessories",
		description: "Casquettes, lunettes et écharpes.",
		image:
			"https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=1400&q=80",
		sortOrder: 3,
	});

	await ensureProduct({
		name: "Tee coton",
		slug: "classic-tee",
		description:
			"Tee en coton mi-lourd, coupe droite. Sert aux démos catalogue et panier.",
		shortDescription: "Coton mi-lourd, coupe droite",
		images: [photo("photo-1521572163474-6864f9cf17ab", "Tee blanc plié")],
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
		name: "Casquette",
		slug: "everyday-cap",
		description: "Casquette en coton, bride réglable.",
		shortDescription: "Coton, bride réglable",
		images: [photo("photo-1588850561407-ed78c282e89b", "Casquette noire")],
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Taille unique / Marine",
				sku: "CAP-NVY-OS",
				price: 1900,
				stockQuantity: 50,
				options: { color: "Marine", size: "TU" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Pull maille",
		slug: "pull-maille",
		description: "Pull en maille fine, col rond.",
		shortDescription: "Maille fine, col rond",
		images: [photo("photo-1434389677669-e08b4cac3105", "Pull beige")],
		categoryIds: [apparel.id],
		variants: [
			{
				name: "Écru / M",
				sku: "SWT-ECR-M",
				price: 7900,
				stockQuantity: 18,
				options: { color: "Écru", size: "M" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Veste denim",
		slug: "veste-denim",
		description: "Veste en denim, coupe droite.",
		shortDescription: "Denim, coupe droite",
		images: [photo("photo-1544022613-e87ca75a784a", "Veste en denim")],
		categoryIds: [apparel.id],
		variants: [
			{
				name: "Indigo / M",
				sku: "JKT-IND-M",
				price: 12900,
				stockQuantity: 12,
				options: { color: "Indigo", size: "M" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Baskets",
		slug: "baskets",
		description: "Baskets basses, semelle contrastée.",
		shortDescription: "Basses, semelle contrastée",
		images: [photo("photo-1460353581641-37baddab0fa2", "Paire de baskets")],
		categoryIds: [shoes.id],
		variants: [
			{
				name: "Rouge / 42",
				sku: "SNK-RED-42",
				price: 9800,
				stockQuantity: 14,
				options: { color: "Rouge", size: "42" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Sandales",
		slug: "sandales",
		description: "Sandales à bride, semelle plate.",
		shortDescription: "Bride, semelle plate",
		images: [photo("photo-1603487742131-4160ec999306", "Sandales")],
		categoryIds: [shoes.id],
		variants: [
			{
				name: "Sable / 40",
				sku: "SDL-SND-40",
				price: 6400,
				stockQuantity: 16,
				options: { color: "Sable", size: "40" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Cabas",
		slug: "cabas",
		description: "Cabas souple, anses longues.",
		shortDescription: "Souple, anses longues",
		images: [photo("photo-1590874103328-eac38a683ce7", "Cabas en cuir")],
		categoryIds: [bags.id],
		variants: [
			{
				name: "Camel",
				sku: "BAG-CML-OS",
				price: 4500,
				stockQuantity: 20,
				options: { color: "Camel" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Sac à dos",
		slug: "sac-a-dos",
		description: "Sac à dos toile, poche avant.",
		shortDescription: "Toile, poche avant",
		images: [photo("photo-1553062407-98eeb64c6a62", "Sac à dos")],
		categoryIds: [bags.id],
		variants: [
			{
				name: "Olive",
				sku: "BPK-OLV-OS",
				price: 8900,
				stockQuantity: 11,
				options: { color: "Olive" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Lunettes",
		slug: "lunettes",
		description: "Lunettes de soleil, monture fine.",
		shortDescription: "Monture fine",
		images: [photo("photo-1511499767150-a48a237f0083", "Lunettes de soleil")],
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Écaille",
				sku: "GLS-TRT-OS",
				price: 3500,
				stockQuantity: 22,
				options: { color: "Écaille" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Écharpe",
		slug: "echarpe",
		description: "Écharpe longue, maille légère.",
		shortDescription: "Maille légère",
		images: [photo("photo-1520903920243-00d872a2d1c9", "Écharpe")],
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Caramel",
				sku: "SCF-CRM-OS",
				price: 2800,
				stockQuantity: 24,
				options: { color: "Caramel" },
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
