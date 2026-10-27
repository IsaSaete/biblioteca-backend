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

describe("Given the GET /wishlist endpoint", () => {
  describe("When a logged-in user has saved books", () => {
    it("Then it should respond 200 with { items, nextCursor, total }, newest first", async () => {
      const { cookie } = createSessionCookie();
      await postWishlist(cookie, buildManualBookDto({ title: "Primero" }));
      await postWishlist(cookie, {
        ...buildManualBookDto({ title: "Segundo" }),
        note: "Una nota",
      });

      const response = await request(app)
        .get("/wishlist")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        items: [
          {
            id: expect.any(String),
            book: expect.objectContaining({ title: "Segundo" }),
            note: "Una nota",
            createdAt: expect.any(String),
          },
          {
            id: expect.any(String),
            book: expect.objectContaining({ title: "Primero" }),
            createdAt: expect.any(String),
          },
        ],
        nextCursor: null,
        total: 2,
      });
    });
  });

  describe("When the user has nothing saved", () => {
    it("Then it should respond 200 with an empty page", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/wishlist")
        .set("Cookie", cookie);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ items: [], nextCursor: null, total: 0 });
    });
  });

  describe("When the cursor is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field cursor", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .get("/wishlist?cursor=nope")
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "cursor",
      });
    });
  });

  describe("When another user has saved books", () => {
    it("Then it should not show them", async () => {
      const mine = createSessionCookie();
      const other = createSessionCookie();
      await postWishlist(other.cookie, buildManualBookDto());

      const response = await request(app)
        .get("/wishlist")
        .set("Cookie", mine.cookie);

      expect(response.body.items).toEqual([]);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app).get("/wishlist");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });
});
