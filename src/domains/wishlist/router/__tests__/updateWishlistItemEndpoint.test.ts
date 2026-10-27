import request from "supertest";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import createSessionCookie, {
  CSRF_TOKEN,
} from "../../../../test/createSessionCookie.js";
import app from "../../../../server/app.js";
import Book from "../../../books/model/Book.js";
import Ejemplar from "../../../books/model/Ejemplar.js";
import { buildManualBookDto } from "../../../books/fixtures/books.fixtures.js";
import WishlistItem from "../../model/WishlistItem.js";

beforeAll(async () => {
  await connectToMemoryDatabase();
  await Book.init();
  await Ejemplar.init();
  await WishlistItem.init();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const postWishlist = (cookie: string, body: unknown) =>
  request(app)
    .post("/wishlist")
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body as object);

const addItem = async (cookie: string): Promise<string> => {
  const response = await postWishlist(cookie, buildManualBookDto());

  return response.body.item.id;
};

const patchItem = (cookie: string, id: string, body: object) =>
  request(app)
    .patch(`/wishlist/${id}`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN)
    .send(body);

describe("Given the PATCH /wishlist/:id endpoint", () => {
  describe("When the user edits the note of their item", () => {
    it("Then it should respond 200 with { item } and GET /wishlist should show it", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await patchItem(cookie, id, { note: "Para regalar" });
      const list = await request(app).get("/wishlist").set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        item: {
          id,
          book: expect.objectContaining({ title: "Apuntes de un viaje" }),
          note: "Para regalar",
          createdAt: expect.any(String),
        },
      });
      expect(list.body.items[0].note).toBe("Para regalar");
    });
  });

  describe("When the user clears the note with null", () => {
    it("Then the item should come back without note", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);
      await patchItem(cookie, id, { note: "Algo" });

      const response = await patchItem(cookie, id, { note: null });

      expect(response.status).toBe(200);
      expect(response.body.item).not.toHaveProperty("note");
    });
  });

  describe("When the note is too long", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field note", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await patchItem(cookie, id, { note: "a".repeat(501) });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "note",
      });
    });
  });

  describe("When the item belongs to another user or the id is made up", () => {
    it("Then it should respond 404 WISHLIST_ITEM_NOT_FOUND", async () => {
      const owner = createSessionCookie();
      const intruder = createSessionCookie();
      const id = await addItem(owner.cookie);

      const foreign = await patchItem(intruder.cookie, id, { note: "x" });
      const invalid = await patchItem(owner.cookie, "no-es-un-id", {
        note: "x",
      });

      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe("WISHLIST_ITEM_NOT_FOUND");
      expect(invalid.status).toBe(404);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .patch("/wishlist/507f1f77bcf86cd799439011")
        .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send({ note: "x" });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and keep the note", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await request(app)
        .patch(`/wishlist/${id}`)
        .set("Cookie", cookie)
        .send({ note: "x" });
      const list = await request(app).get("/wishlist").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(list.body.items[0]).not.toHaveProperty("note");
    });
  });
});
