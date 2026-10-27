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

const acquire = (cookie: string, id: string, body?: object) => {
  const req = request(app)
    .post(`/wishlist/${id}/acquire`)
    .set("Cookie", cookie)
    .set("X-CSRF-Token", CSRF_TOKEN);

  return body ? req.send(body) : req;
};

describe("Given the POST /wishlist/:id/acquire endpoint", () => {
  describe("When the user acquires one of their wishlist items without a body", () => {
    it("Then it should respond 201 with { book, ejemplar }, the item should leave Deseados and the book appear in the library", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await acquire(cookie, id);
      const wishlist = await request(app)
        .get("/wishlist")
        .set("Cookie", cookie);
      const library = await request(app).get("/books").set("Cookie", cookie);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        book: expect.objectContaining({ title: "Apuntes de un viaje" }),
        ejemplar: expect.objectContaining({
          id: expect.any(String),
          status: "pending",
          favorite: false,
        }),
      });
      expect(wishlist.body.total).toBe(0);
      expect(library.body.total).toBe(1);
    });
  });

  describe("When the user sends a reading status", () => {
    it("Then the Ejemplar should have it", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await acquire(cookie, id, { status: "reading" });

      expect(response.status).toBe(201);
      expect(response.body.ejemplar.status).toBe("reading");
    });
  });

  describe("When the status is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with field status and keep the item", async () => {
      const { cookie } = createSessionCookie();
      const id = await addItem(cookie);

      const response = await acquire(cookie, id, { status: "perdido" });
      const wishlist = await request(app)
        .get("/wishlist")
        .set("Cookie", cookie);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "status",
      });
      expect(wishlist.body.total).toBe(1);
    });
  });

  describe("When the item belongs to another user or the id is made up", () => {
    it("Then it should respond 404 WISHLIST_ITEM_NOT_FOUND", async () => {
      const owner = createSessionCookie();
      const intruder = createSessionCookie();
      const id = await addItem(owner.cookie);

      const foreign = await acquire(intruder.cookie, id);
      const invalid = await acquire(owner.cookie, "no-es-un-id");

      expect(foreign.status).toBe(404);
      expect(foreign.body.error.code).toBe("WISHLIST_ITEM_NOT_FOUND");
      expect(invalid.status).toBe(404);
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/wishlist/507f1f77bcf86cd799439011/acquire")
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
        .post(`/wishlist/${id}/acquire`)
        .set("Cookie", cookie);
      const wishlist = await request(app)
        .get("/wishlist")
        .set("Cookie", cookie);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(wishlist.body.total).toBe(1);
    });
  });
});
