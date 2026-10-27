import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import {
  OTHER_EDITION_ISBN_13,
  buildCreateBookDto,
} from "../../../books/fixtures/books.fixtures.js";
import { buildAddToWishlistDto } from "../../../wishlist/fixtures/wishlist.fixtures.js";
import { buildCreateQuoteDto } from "../../../quotes/fixtures/quotes.fixtures.js";
import {
  buildLoginDto,
  buildRegisterDto,
  validRegisterDto,
} from "../../fixtures/auth.fixtures.js";

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
const { default: Book } = await import("../../../books/model/Book.js");
const { default: WishlistItem } =
  await import("../../../wishlist/model/WishlistItem.js");
const { default: WishlistService } =
  await import("../../../wishlist/service/WishlistService.js");
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

const addWishlistItem = (userId: string) =>
  WishlistService.addToWishlist(
    userId,
    buildAddToWishlistDto({ isbn: OTHER_EDITION_ISBN_13 }),
  );

const addBookWithQuote = async (userId: string) => {
  const { ejemplar } = await BooksService.createBook(
    userId,
    buildCreateBookDto(),
  );
  await QuotesService.createQuote(userId, buildCreateQuoteDto(ejemplar.id));
  await QuotesService.createQuote(userId, { text: "Una cita suelta" });
};

describe("Given the AuthService.deleteAccount function", () => {
  describe("When the password is right", () => {
    it("Then it should delete the user, their ejemplares and all their quotes, also those without book", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await addBookWithQuote(user.id);

      await AuthService.deleteAccount(user.id, {
        password: validRegisterDto.password,
      });

      expect(await User.findById(user.id)).toBeNull();
      expect(await Ejemplar.countDocuments({ userId: user.id })).toBe(0);
      expect(await Quote.countDocuments({ userId: user.id })).toBe(0);
    });

    it("Then it should delete their wishlist items but keep the shared Libro", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await addWishlistItem(user.id);

      await AuthService.deleteAccount(user.id, {
        password: validRegisterDto.password,
      });

      expect(await WishlistItem.countDocuments({ userId: user.id })).toBe(0);
      expect(await Book.countDocuments()).toBe(1);
    });

    it("Then it should keep the shared Libro", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await addBookWithQuote(user.id);

      await AuthService.deleteAccount(user.id, {
        password: validRegisterDto.password,
      });

      expect(await Book.countDocuments()).toBe(1);
    });

    it("Then the account should no longer log in", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await AuthService.deleteAccount(user.id, {
        password: validRegisterDto.password,
      });

      await expect(
        AuthService.loginUser(buildLoginDto()),
      ).rejects.toMatchObject({ code: "AUTH_INVALID_CREDENTIALS" });
    });
  });

  describe("When another user has books and quotes, even of the same Libro", () => {
    it("Then it should leave all of theirs untouched", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      const { user: other } = await registerOther();
      await addBookWithQuote(user.id);
      await addBookWithQuote(other.id);
      await addWishlistItem(user.id);
      await addWishlistItem(other.id);

      await AuthService.deleteAccount(user.id, {
        password: validRegisterDto.password,
      });

      expect(await WishlistItem.countDocuments({ userId: other.id })).toBe(1);
      expect(await User.findById(other.id)).not.toBeNull();
      expect(await Ejemplar.countDocuments({ userId: other.id })).toBe(1);
      expect(await Quote.countDocuments({ userId: other.id })).toBe(2);
      expect(await Book.countDocuments()).toBe(2);
    });
  });

  describe("When the password is wrong", () => {
    it("Then it should fail with AUTH_INVALID_CREDENTIALS and delete nothing", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await addBookWithQuote(user.id);
      await addWishlistItem(user.id);

      await expect(
        AuthService.deleteAccount(user.id, { password: "Wr0ng!Password" }),
      ).rejects.toMatchObject({
        code: "AUTH_INVALID_CREDENTIALS",
        httpStatus: 401,
      });
      expect(await User.findById(user.id)).not.toBeNull();
      expect(await Ejemplar.countDocuments({ userId: user.id })).toBe(1);
      expect(await Quote.countDocuments({ userId: user.id })).toBe(2);
      expect(await WishlistItem.countDocuments({ userId: user.id })).toBe(1);
    });
  });

  describe.each([
    ["missing", {}],
    ["empty", { password: "" }],
    ["not a string", { password: 1 }],
  ])("When the password is %s", (_case, body) => {
    it("Then it should fail with VALIDATION_ERROR on password and delete nothing", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());

      await expect(
        AuthService.deleteAccount(user.id, body),
      ).rejects.toMatchObject({ code: "VALIDATION_ERROR", field: "password" });
      expect(await User.findById(user.id)).not.toBeNull();
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.deleteAccount(unknownId, {
          password: validRegisterDto.password,
        }),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
