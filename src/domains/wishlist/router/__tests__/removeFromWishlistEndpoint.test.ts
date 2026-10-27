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

const deleteItem = (cookie: string, id: string) =>
  request(app)
    .delete(`/wishlist/${id}`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN);

describe("Given the DELETE /wishlist/:id endpoint", () => {
  describe("When the user removes one of their items", () => {
    it("Then it should respond 204 and the list should no longer show it", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await deleteItem(cookie, id);
      const list = await request(app).get("/wishlist").set("Cookie", cookie);

      expect(response.status).toBe(204);
      expect(list.body).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When the item belongs to another user or the id is made up", () => {
    it("Then it should respond 404 WISHLIST_ITEM_NOT_FOUND and keep the item", async () => {
      const owner = createSessionCookie();
      const intruder = createSessionCookie();
      const id = await addItem(owner.cookie);

      const foreign = await deleteItem(intruder.cookie, id);
      const invalid = await deleteItem(owner.cookie, "no-es-un-id");
      const list = await request(app)
        .get("/wishlist")
        .set("Cookie", owner.cookie);

      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe("WISHLIST_ITEM_NOT_FOUND");
      expect(invalid.status).toBe(404);
      expect(list.body.total).toBe(1);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .delete("/wishlist/507f1f77bcf86cd799439011")
        .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
        .set("X-CSRF-Token", CSRF_TOKEN);

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and keep the item", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await request(app)
        .delete(`/wishlist/${id}`)
        .set("Cookie", cookie);
      const list = await request(app).get("/wishlist").set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(list.body.total).toBe(1);
    });
  });
});
