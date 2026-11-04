import { z } from "@hono/zod-openapi";
import { createSelectSchema } from "drizzle-zod";
import { categories, products, productVariants } from "@/db/schema.js";

export const selectCategorySchema = createSelectSchema(categories);
export const selectProductSchema = createSelectSchema(products);
export const selectProductVariantSchema = createSelectSchema(productVariants);

export const productWithVariantsSchema = selectProductSchema.extend({
	variants: z.array(selectProductVariantSchema),
});

export const slugParamsSchema = z.object({
	slug: z
		.string()
		.min(1)
		.openapi({
			param: { name: "slug", in: "path" },
			example: "t-shirt",
		}),
});

export const listProductsQuerySchema = z.object({
	categorySlug: z
		.string()
		.optional()
		.openapi({
			param: { name: "categorySlug", in: "query" },
		}),
	limit: z.coerce
		.number()
		.int()
		.positive()
		.max(100)
		.default(20)
		.openapi({
			param: { name: "limit", in: "query" },
		}),
	offset: z.coerce
		.number()
		.int()
		.nonnegative()
		.default(0)
		.openapi({
			param: { name: "offset", in: "query" },
		}),
});
