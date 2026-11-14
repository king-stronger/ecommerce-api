import { afterEach, describe, expect, it } from "vitest";
import {
	api,
	cleanupEcommerceFixtures,
	createTestUser,
} from "@/test/helpers.js";

describe("auth session", () => {
	const fixtures: { userIds: string[] } = { userIds: [] };

	afterEach(async () => {
		await cleanupEcommerceFixtures({ userIds: fixtures.userIds });
		fixtures.userIds = [];
	});

	it("returns null session without a cookie", async () => {
		const res = await api("/api/auth/get-session");
		expect(res.status).toBe(200);
		const body = await res.json();
		expect(body).toBeNull();
	});

	it("returns the signed-in user for a valid session cookie", async () => {
		const user = await createTestUser({ name: "Session User" });
		fixtures.userIds.push(user.id);

		const res = await api("/api/auth/get-session", {
			headers: { cookie: user.cookie },
		});
		expect(res.status).toBe(200);
		const body = (await res.json()) as {
			user: { id: string; email: string; name: string };
			session: { userId: string };
		} | null;
		expect(body?.user.id).toBe(user.id);
		expect(body?.user.email).toBe(user.email);
		expect(body?.session.userId).toBe(user.id);
	});
});
