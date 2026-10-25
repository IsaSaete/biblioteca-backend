import { jest } from "@jest/globals";
import {
  clearMemoryDatabase,
  connectToMemoryDatabase,
  disconnectMemoryDatabase,
} from "../../../../test/memoryDatabase.js";
import { buildRegisterDto } from "../../fixtures/auth.fixtures.js";

jest.unstable_mockModule(
  "../../../../shared/email/sendVerificationEmail.js",
  () => ({
    default: jest
      .fn<(to: string, token: string) => Promise<void>>()
      .mockResolvedValue(undefined),
  }),
);

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

describe("Given the AuthService.completeOnboarding function", () => {
  describe("When a user who has not seen the onboarding completes it", () => {
    it("Then it should store the date and getCurrentUser should report it as completed", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      expect(user.onboardingCompleted).toBe(false);

      await AuthService.completeOnboarding(user.id);

      const stored = await User.findById(user.id);
      expect(stored?.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(
        (await AuthService.getCurrentUser(user.id)).onboardingCompleted,
      ).toBe(true);
    });
  });

  describe("When it is called again", () => {
    it("Then it should not change the date nor fail", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await AuthService.completeOnboarding(user.id);
      const firstDate = (await User.findById(user.id))?.onboardingCompletedAt;

      await expect(
        AuthService.completeOnboarding(user.id),
      ).resolves.toBeUndefined();

      const secondDate = (await User.findById(user.id))?.onboardingCompletedAt;
      expect(secondDate?.getTime()).toBe(firstDate?.getTime());
    });
  });

  describe("When another user exists", () => {
    it("Then it should only mark the user who completed it", async () => {
      const first = await AuthService.registerUser(buildRegisterDto());
      const second = await AuthService.registerUser(
        buildRegisterDto({ email: "otra@example.com" }),
      );

      await AuthService.completeOnboarding(first.user.id);

      expect(
        (await AuthService.getCurrentUser(second.user.id)).onboardingCompleted,
      ).toBe(false);
    });
  });

  describe("When the account was created before the field existed", () => {
    it("Then it should be reported as not completed and be completable", async () => {
      const { user } = await AuthService.registerUser(buildRegisterDto());
      await User.collection.updateOne(
        { _id: new mongoose.Types.ObjectId(user.id) },
        { $unset: { onboardingCompletedAt: "" } },
      );

      expect(
        (await AuthService.getCurrentUser(user.id)).onboardingCompleted,
      ).toBe(false);
      await AuthService.completeOnboarding(user.id);
      expect(
        (await AuthService.getCurrentUser(user.id)).onboardingCompleted,
      ).toBe(true);
    });
  });

  describe("When the user no longer exists", () => {
    it("Then it should fail with AUTH_UNAUTHENTICATED", async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();

      await expect(
        AuthService.completeOnboarding(unknownId),
      ).rejects.toMatchObject({
        code: "AUTH_UNAUTHENTICATED",
        httpStatus: 401,
      });
    });
  });
});
