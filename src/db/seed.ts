/**
 * Demo seed for local / portfolio use. Idempotent by slug / code / email.
 * Run: pnpm db:seed
 */
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { eq, inArray } from "drizzle-orm";
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

const u = (id: string) =>
	`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=80`;

function photos(...entries: Array<[string, string]>) {
	return entries.map(([id, alt], sort) => ({ url: u(id), alt, sort }));
}

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
				isActive: true,
			})
			.where(eq(categories.id, existing.id))
			.returning();
		console.log(`  ~ category ${row.slug}`);
		return row;
	}
	const [row] = await db
		.insert(categories)
		.values({ ...input, isActive: true })
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
				status: "active",
			})
			.where(eq(products.id, existing.id));

		await db
			.delete(productCategories)
			.where(eq(productCategories.productId, existing.id));
		if (input.categoryIds.length > 0) {
			await db.insert(productCategories).values(
				input.categoryIds.map((categoryId) => ({
					productId: existing.id,
					categoryId,
				})),
			);
		}

		for (const variant of input.variants) {
			const [current] = await db
				.select()
				.from(productVariants)
				.where(eq(productVariants.sku, variant.sku))
				.limit(1);
			if (current) {
				await db
					.update(productVariants)
					.set({
						name: variant.name,
						price: variant.price,
						compareAtPrice: variant.compareAtPrice ?? null,
						stockQuantity: variant.stockQuantity,
						options: variant.options,
						isDefault: variant.isDefault,
						isActive: true,
					})
					.where(eq(productVariants.id, current.id));
			} else {
				await db.insert(productVariants).values({
					productId: existing.id,
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
				});
			}
		}

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
	console.log("Seeding FORMA demo catalog…");

	await db
		.update(categories)
		.set({ isActive: false })
		.where(
			inArray(categories.slug, [
				"demo",
				"apparel",
				"chaussures",
				"sacs",
				"accessories",
			]),
		);

	const women = await ensureCategory({
		name: "Women",
		slug: "women",
		description: "Dresses, knits, and everyday layers.",
		image: u("photo-1515372039744-b8f02a3ae446"),
		sortOrder: 0,
	});
	const men = await ensureCategory({
		name: "Men",
		slug: "men",
		description: "Tees, outerwear, and easy trousers.",
		image: u("photo-1617137968427-85924c800a22"),
		sortOrder: 1,
	});
	const bags = await ensureCategory({
		name: "Bags",
		slug: "bags",
		description: "Totes, backpacks, and day bags.",
		image: u("photo-1590874103328-eac38a683ce7"),
		sortOrder: 2,
	});
	const shoes = await ensureCategory({
		name: "Shoes",
		slug: "shoes",
		description: "Sneakers and sandals.",
		image: u("photo-1460353581641-37baddab0fa2"),
		sortOrder: 3,
	});
	const accessories = await ensureCategory({
		name: "Accessories",
		slug: "accessories",
		description: "Hats, eyewear, and soft extras.",
		image: u("photo-1511499767150-a48a237f0083"),
		sortOrder: 4,
	});

	await ensureProduct({
		name: "Column Dress",
		slug: "column-dress",
		description:
			"A clean column silhouette in soft cotton. Seeded for the FORMA storefront demo.",
		shortDescription: "Organic cotton — cream",
		images: photos(
			["photo-1515372039744-b8f02a3ae446", "Column dress front"],
			["photo-1496747611176-843222e1e57c", "Column dress detail"],
		),
		categoryIds: [women.id],
		variants: [
			{
				name: "Cream / S",
				sku: "DRS-CRM-S",
				price: 18900,
				stockQuantity: 10,
				options: { color: "Cream", size: "S" },
				isDefault: true,
			},
			{
				name: "Cream / M",
				sku: "DRS-CRM-M",
				price: 18900,
				stockQuantity: 12,
				options: { color: "Cream", size: "M" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Linen Blouse",
		slug: "linen-blouse",
		description: "Relaxed linen blouse with a soft collar.",
		shortDescription: "Linen — ivory",
		images: photos(["photo-1564257631407-4deb1f99d992", "Linen blouse"]),
		categoryIds: [women.id],
		variants: [
			{
				name: "Ivory / S",
				sku: "BLS-IVR-S",
				price: 9800,
				stockQuantity: 14,
				options: { color: "Ivory", size: "S" },
				isDefault: true,
			},
			{
				name: "Ivory / M",
				sku: "BLS-IVR-M",
				price: 9800,
				stockQuantity: 16,
				options: { color: "Ivory", size: "M" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Tailored Trousers",
		slug: "tailored-trousers",
		description: "Straight tailored trousers with a clean crease.",
		shortDescription: "Wool blend — sand",
		images: photos(["photo-1594633312681-425c7b97ccd1", "Tailored trousers"]),
		categoryIds: [women.id],
		variants: [
			{
				name: "Sand / 36",
				sku: "TRS-SND-36",
				price: 14200,
				stockQuantity: 9,
				options: { color: "Sand", size: "36" },
				isDefault: true,
			},
			{
				name: "Sand / 38",
				sku: "TRS-SND-38",
				price: 14200,
				stockQuantity: 11,
				options: { color: "Sand", size: "38" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Knit Cardigan",
		slug: "knit-cardigan",
		description: "Open-front cardigan in a soft midweight knit.",
		shortDescription: "Merino blend — camel",
		images: photos(["photo-1434389677669-e08b4cac3105", "Knit cardigan"]),
		categoryIds: [women.id],
		variants: [
			{
				name: "Camel / M",
				sku: "CRD-CML-M",
				price: 12800,
				stockQuantity: 13,
				options: { color: "Camel", size: "M" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Cotton Tee",
		slug: "classic-tee",
		description: "Midweight cotton tee with a straight cut.",
		shortDescription: "Cotton — black / white",
		images: photos(
			["photo-1521572163474-6864f9cf17ab", "Cotton tee"],
			["photo-1583743814966-8936f5b7be1a", "Cotton tee folded"],
		),
		categoryIds: [men.id],
		variants: [
			{
				name: "Black / S",
				sku: "TEE-BLK-S",
				price: 3900,
				compareAtPrice: 4900,
				stockQuantity: 25,
				options: { color: "Black", size: "S" },
				isDefault: true,
			},
			{
				name: "Black / M",
				sku: "TEE-BLK-M",
				price: 3900,
				compareAtPrice: 4900,
				stockQuantity: 40,
				options: { color: "Black", size: "M" },
				isDefault: false,
			},
			{
				name: "White / M",
				sku: "TEE-WHT-M",
				price: 3900,
				stockQuantity: 30,
				options: { color: "White", size: "M" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Overshirt",
		slug: "overshirt",
		description: "Utility overshirt with chest pockets.",
		shortDescription: "Cotton twill — olive",
		images: photos(["photo-1591047139829-d91aecb6caea", "Overshirt"]),
		categoryIds: [men.id],
		variants: [
			{
				name: "Olive / M",
				sku: "OVS-OLV-M",
				price: 11800,
				stockQuantity: 12,
				options: { color: "Olive", size: "M" },
				isDefault: true,
			},
			{
				name: "Olive / L",
				sku: "OVS-OLV-L",
				price: 11800,
				stockQuantity: 10,
				options: { color: "Olive", size: "L" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Denim Jacket",
		slug: "veste-denim",
		description: "Classic denim jacket with a straight fit.",
		shortDescription: "Denim — indigo",
		images: photos(["photo-1544022613-e87ca75a784a", "Denim jacket"]),
		categoryIds: [men.id],
		variants: [
			{
				name: "Indigo / M",
				sku: "JKT-IND-M",
				price: 14900,
				stockQuantity: 12,
				options: { color: "Indigo", size: "M" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Wool Sweater",
		slug: "pull-maille",
		description: "Fine-gauge crewneck sweater.",
		shortDescription: "Wool — ecru",
		images: photos(["photo-1576566588028-4147f3842f27", "Wool sweater"]),
		categoryIds: [men.id],
		variants: [
			{
				name: "Ecru / M",
				sku: "SWT-ECR-M",
				price: 11000,
				stockQuantity: 18,
				options: { color: "Ecru", size: "M" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Structured Tote",
		slug: "cabas",
		description: "Structured tote with long handles.",
		shortDescription: "Leather — camel",
		images: photos(
			["photo-1590874103328-eac38a683ce7", "Structured tote"],
			["photo-1548036328-c9fa89d128fa", "Tote detail"],
		),
		categoryIds: [bags.id],
		variants: [
			{
				name: "Camel",
				sku: "BAG-CML-OS",
				price: 16500,
				stockQuantity: 20,
				options: { color: "Camel" },
				isDefault: true,
			},
			{
				name: "Black",
				sku: "BAG-BLK-OS",
				price: 16500,
				stockQuantity: 15,
				options: { color: "Black" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Canvas Backpack",
		slug: "sac-a-dos",
		description: "Canvas backpack with a front pocket.",
		shortDescription: "Canvas — olive",
		images: photos(["photo-1553062407-98eeb64c6a62", "Canvas backpack"]),
		categoryIds: [bags.id],
		variants: [
			{
				name: "Olive",
				sku: "BPK-OLV-OS",
				price: 9800,
				stockQuantity: 11,
				options: { color: "Olive" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Crossbody Bag",
		slug: "crossbody-bag",
		description: "Compact crossbody with an adjustable strap.",
		shortDescription: "Leather — taupe",
		images: photos(["photo-1584917865442-de89df76afd3", "Crossbody bag"]),
		categoryIds: [bags.id],
		variants: [
			{
				name: "Taupe",
				sku: "XB-TPE-OS",
				price: 12400,
				stockQuantity: 14,
				options: { color: "Taupe" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Court Sneakers",
		slug: "baskets",
		description: "Low court sneakers with a contrast sole.",
		shortDescription: "Leather — white",
		images: photos(
			["photo-1460353581641-37baddab0fa2", "Court sneakers"],
			["photo-1606107557195-0e29a4b5b4aa", "Sneaker pair"],
		),
		categoryIds: [shoes.id],
		variants: [
			{
				name: "White / 41",
				sku: "SNK-WHT-41",
				price: 12800,
				stockQuantity: 14,
				options: { color: "White", size: "41" },
				isDefault: true,
			},
			{
				name: "White / 42",
				sku: "SNK-WHT-42",
				price: 12800,
				stockQuantity: 16,
				options: { color: "White", size: "42" },
				isDefault: false,
			},
			{
				name: "White / 43",
				sku: "SNK-WHT-43",
				price: 12800,
				stockQuantity: 12,
				options: { color: "White", size: "43" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Leather Sandals",
		slug: "sandales",
		description: "Flat strap sandals in soft leather.",
		shortDescription: "Leather — sand",
		images: photos(["photo-1603487742131-4160ec999306", "Leather sandals"]),
		categoryIds: [shoes.id],
		variants: [
			{
				name: "Sand / 39",
				sku: "SDL-SND-39",
				price: 8900,
				stockQuantity: 10,
				options: { color: "Sand", size: "39" },
				isDefault: true,
			},
			{
				name: "Sand / 40",
				sku: "SDL-SND-40",
				price: 8900,
				stockQuantity: 16,
				options: { color: "Sand", size: "40" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Slip-On Loafers",
		slug: "loafers",
		description: "Soft leather loafers for everyday wear.",
		shortDescription: "Leather — brown",
		images: photos(["photo-1533867617858-e7b97e060509", "Loafers"]),
		categoryIds: [shoes.id],
		variants: [
			{
				name: "Brown / 42",
				sku: "LOF-BRN-42",
				price: 15600,
				stockQuantity: 8,
				options: { color: "Brown", size: "42" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Soft Cap",
		slug: "everyday-cap",
		description: "Soft cotton cap with an adjustable strap.",
		shortDescription: "Cotton — navy",
		images: photos(["photo-1588850561407-ed78c282e89b", "Soft cap"]),
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Navy / One size",
				sku: "CAP-NVY-OS",
				price: 3200,
				stockQuantity: 50,
				options: { color: "Navy", size: "One size" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Sunglasses",
		slug: "lunettes",
		description: "Slim acetate sunglasses.",
		shortDescription: "Acetate — tortoise",
		images: photos(
			["photo-1511499767150-a48a237f0083", "Sunglasses"],
			["photo-1572635196237-14b3f281503f", "Sunglasses side"],
		),
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Tortoise",
				sku: "GLS-TRT-OS",
				price: 7800,
				stockQuantity: 22,
				options: { color: "Tortoise" },
				isDefault: true,
			},
			{
				name: "Black",
				sku: "GLS-BLK-OS",
				price: 7800,
				stockQuantity: 18,
				options: { color: "Black" },
				isDefault: false,
			},
		],
	});

	await ensureProduct({
		name: "Wool Scarf",
		slug: "echarpe",
		description: "Long scarf in a light wool knit.",
		shortDescription: "Wool — caramel",
		images: photos(["photo-1520903920243-00d872a2d1c9", "Wool scarf"]),
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Caramel",
				sku: "SCF-CRM-OS",
				price: 5400,
				stockQuantity: 24,
				options: { color: "Caramel" },
				isDefault: true,
			},
		],
	});

	await ensureProduct({
		name: "Leather Belt",
		slug: "leather-belt",
		description: "Slim leather belt with a brushed buckle.",
		shortDescription: "Leather — black",
		images: photos(["photo-1624222247344-550fb60583fd", "Leather belt"]),
		categoryIds: [accessories.id],
		variants: [
			{
				name: "Black / 85",
				sku: "BLT-BLK-85",
				price: 4800,
				stockQuantity: 20,
				options: { color: "Black", size: "85" },
				isDefault: true,
			},
			{
				name: "Black / 90",
				sku: "BLT-BLK-90",
				price: 4800,
				stockQuantity: 18,
				options: { color: "Black", size: "90" },
				isDefault: false,
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
