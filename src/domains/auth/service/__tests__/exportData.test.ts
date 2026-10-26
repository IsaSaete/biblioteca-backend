import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildJpegBuffer } from "../../fixtures/auth.fixtures.js";
import { buildCreateBookDto } from "../../../books/fixtures/books.fixtures.js";
import { buildCreateQuoteDto } from "../../../quotes/fixtures/quotes.fixtures.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

const { default: BooksService } =
  await import("../../../books/service/BooksService.js");
const { default: QuotesService } =
  await import("../../../quotes/service/QuotesService.js");
const { default: Quote } = await import("../../../quotes/model/Quote.js");
const { default: Ejemplar } = await import("../../../books/model/Ejemplar.js");
const { default: AuthService } = await import("../AuthService.js");
const { default: User } = await import("../../model/User.js");
const { default: mongoose } = await import("mongoose");

beforeAll(async () => {
  await connectToMemoryDatabase();
});

afterEach(async () => {
  await clearMemoryDatabase();
});

afterAll(async () => {
  await disconnectMemoryDatabase();
});

const registerOther = () =>
  AuthService.registerUser(buildRegisterDto({ email: "otra@example.com" }));

describe("Given the AuthService.exportData function", () => {
  describe("When the user has books and quotes", () => {
    it("Then it should return their account, library and quotes in the API shapes", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const { book, ejemplar } = await BooksService.createBook(
        user.id,
        buildCreateBookDto(),
      );
      await BooksService.updateEjemplar(user.id, book.id, {
        favorite: true,
        overrides: { title: "Mi edición" },
      });
      const linked = await QuotesService.createQuote(
        user.id,
        buildCreateQuoteDto(ejemplar.id),
      );
      const unlinked = await QuotesService.createQuote(user.id, {
        text: "Una cita suelta",
        source: "Una conversación",
      });

      const data = await AuthService.exportData(user.id);

      expect(data.exportedAt).toEqual(expect.any(String));
      expect(data.user).toEqual({
        id: user.id,
        name: "Isa",
        email: "isa@example.com",
        createdAt: expect.any(String),
      });
      expect(data.books).toEqual([
        {
          book,
          ejemplar: expect.objectContaining({
            id: ejemplar.id,
            favorite: true,
            overrides: { title: "Mi edición" },
          }),
        },
      ]);
      expect(data.books[0].book.title).toBe("La sombra del viento");
      expect(data.quotes).toEqual([
        { ...linked, book: { ...linked.book, title: "Mi edición" } },
        unlinked,
      ]);
    });
  });

  describe("When the user has nothing saved", () => {
    it("Then books and quotes should be empty lists", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      const data = await AuthService.exportData(user.id);

      expect(data.books).toEqual([]);
      expect(data.quotes).toEqual([]);
    });
  });

  describe("When the account has hashes, tokens and a photo", () => {
    it("Then none of them should appear in the export", async () => {
      const { user, session } =
        await AuthService.registerUser(buildRegisterDto());
      await AuthService.uploadAvatar(user.id, buildJpegBuffer());
      const stored = await User.findById(user.id);

      const data = await AuthService.exportData(user.id);

      const json = JSON.stringify(data);
      expect(Object.keys(data.user).sort()).toEqual([
        "createdAt",
        "email",
        "id",
        "name",
      ]);
      expect(json).not.toContain(stored?.passwordHash);
      expect(json).not.toContain(stored?.refreshTokenHash);
      expect(json).not.toContain(stored?.emailVerificationTokenHash);
      expect(json).not.toContain(session.refreshToken);
      expect(json).not.toMatch(/passwordHash|TokenHash|avatar/);
    });
  });

  describe("When another user has books and quotes", () => {
    it("Then the export should not include any of them", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const { user: other } = await registerOther();
      const { ejemplar } = await BooksService.createBook(
        other.id,
        buildCreateBookDto(),
      );
      await QuotesService.createQuote(
        other.id,
        buildCreateQuoteDto(ejemplar.id),
      );

      const data = await AuthService.exportData(user.id);

      expect(data.books).toEqual([]);
      expect(data.quotes).toEqual([]);
      expect(JSON.stringify(data)).not.toContain("otra@example.com");
    });
  });

  describe("When a quote points to a book that no longer exists", () => {
    it("Then the quote should still be exported, without book", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const { ejemplar } = await BooksService.createBook(
        user.id,
        buildCreateBookDto(),
      );
      await QuotesService.createQuote(
        user.id,
        buildCreateQuoteDto(ejemplar.id),
      );
      await Ejemplar.deleteMany({ userId: user.id });

      const data = await AuthService.exportData(user.id);

      expect(data.books).toEqual([]);
      expect(data.quotes).toHaveLength(1);
      expect(data.quotes[0]).not.toHaveProperty("book");
      expect(await Quote.countDocuments({ userId: user.id })).toBe(1);
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(AuthService.exportData(unknownId)).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
