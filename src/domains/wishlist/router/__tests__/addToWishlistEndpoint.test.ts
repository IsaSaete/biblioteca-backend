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
import BooksService from "../../../books/service/BooksService.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
import WishlistItem from "../../model/WishlistItem.js";
import { buildAddToWishlistDto } from "../../fixtures/wishlist.fixtures.js";

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

describe("Given the POST /wishlist endpoint", () => {
  describe("When a logged-in user saves a book with a note", () => {
    it("Then it should respond 201 with { item } in the contract shape", async () => {
      const { cookie } = createSessionCookie();

      const response = await postWishlist(
        cookie,
        buildAddToWishlistDto({ note: "Para el verano" }),
      );

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        item: {
          id: expect.any(String),
          book: expect.objectContaining({
            id: expect.any(String),
            title: "La sombra del viento",
            authors: ["Carlos Ruiz Zafón"],
          }),
          note: "Para el verano",
          createdAt: expect.any(String),
        },
      });
    });
  });

  describe("When the body tries to set the owner", () => {
    it("Then the item should belong to the session user", async () => {
      const { cookie, userId } = createSessionCookie();

      await postWishlist(cookie, {
        ...buildAddToWishlistDto(),
        userId: "000000000000000000000001",
      });

      expect(await WishlistItem.countDocuments({ userId })).toBe(1);
      expect(await WishlistItem.countDocuments()).toBe(1);
    });
  });

  describe("When the user already has the book in their library", () => {
    it("Then it should respond 409 BOOK_ALREADY_IN_LIBRARY", async () => {
      const { cookie, userId } = createSessionCookie();
      await BooksService.createBook(userId, buildCreateBookDto());

      const response = await postWishlist(cookie, buildAddToWishlistDto());

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("BOOK_ALREADY_IN_LIBRARY");
    });
  });

  describe("When the book is already in the wishlist", () => {
    it("Then it should respond 409 BOOK_ALREADY_IN_WISHLIST", async () => {
      const { cookie } = createSessionCookie();
      await postWishlist(cookie, buildAddToWishlistDto());

      const response = await postWishlist(cookie, buildAddToWishlistDto());

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe("BOOK_ALREADY_IN_WISHLIST");
    });
  });

  describe("When the body is not valid", () => {
    it("Then it should respond 400 VALIDATION_ERROR with the field", async () => {
      const { cookie } = createSessionCookie();

      const response = await postWishlist(cookie, {
        ...buildAddToWishlistDto(),
        note: "a".repeat(501),
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toMatchObject({
        code: "VALIDATION_ERROR",
        field: "note",
      });
    });
  });

  describe("When the request has no session", () => {
    it("Then it should respond 401 AUTH_UNAUTHENTICATED", async () => {
      const response = await request(app)
        .post("/wishlist")
        .set("Cookie", `csrfToken=${CSRF_TOKEN}`)
        .set("X-CSRF-Token", CSRF_TOKEN)
        .send(buildAddToWishlistDto());

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("AUTH_UNAUTHENTICATED");
    });
  });

  describe("When the request has a session but no CSRF header", () => {
    it("Then it should respond 403 CSRF_INVALID and save nothing", async () => {
      const { cookie } = createSessionCookie();

      const response = await request(app)
        .post("/wishlist")
        .set("Cookie", cookie)
        .send(buildAddToWishlistDto());

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe("CSRF_INVALID");
      expect(await WishlistItem.countDocuments()).toBe(0);
    });
  });
});
