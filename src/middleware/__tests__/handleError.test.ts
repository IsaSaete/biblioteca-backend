import { jest } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";
import NotFoundError from "../../shared/errors/NotFoundError.js";
import ValidationError from "../../shared/errors/ValidationError.js";
import handleError from "../handleError.js";

const req = {} as Request;
const status = jest.fn<Response["status"]>();
const json = jest.fn<Response["json"]>();
const res = { status, json } as unknown as Response;
const next = jest.fn() as unknown as NextFunction;

status.mockReturnValue(res);

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Given the handleError middleware", () => {
  describe("When it receives a ValidationError with a field", () => {
    const error = new ValidationError(
      "AUTH_WEAK_PASSWORD",
      "La contraseña es débil",
      "password",
    );

    it("Then it should respond with the error's own httpStatus", () => {
      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(400);
    });

    it("Then it should respond with the error's code, message and field", () => {
      handleError(error, req, res, next);

      expect(json).toHaveBeenCalledWith({
        error: {
          code: "AUTH_WEAK_PASSWORD",
          message: "La contraseña es débil",
          field: "password",
        },
      });
    });
  });

  describe("When it receives a NotFoundError without a field", () => {
    const error = new NotFoundError("BOOK_NOT_FOUND", "Libro no encontrado");

    it("Then it should respond with 404", () => {
      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(404);
    });

    it("Then it should respond without a field key", () => {
      handleError(error, req, res, next);

      expect(json).toHaveBeenCalledWith({
        error: {
          code: "BOOK_NOT_FOUND",
          message: "Libro no encontrado",
        },
      });
    });
  });

  describe("When it receives an error that is not an AppError", () => {
    const error = new Error("Cannot read properties of undefined");

    it("Then it should respond with 500", () => {
      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(500);
    });

    it("Then it should respond with a generic error message, never the original one", () => {
      handleError(error, req, res, next);

      expect(json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Ha ocurrido un error inesperado",
        },
      });
    });
  });

  describe("When express.json rejects a body that is not valid JSON", () => {
    const error = Object.assign(new SyntaxError("Unexpected end of JSON"), {
      type: "entity.parse.failed",
      status: 400,
    });

    it("Then it should respond 400 with a VALIDATION_ERROR and not log it as an unhandled error", () => {
      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: "VALIDATION_ERROR",
          message: "El cuerpo de la petición no es un JSON válido",
        },
      });
    });
  });

  describe("When express.json rejects a body that is too large", () => {
    const error = Object.assign(new Error("request entity too large"), {
      type: "entity.too.large",
      status: 413,
    });

    it("Then it should respond 413 with a VALIDATION_ERROR", () => {
      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(413);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: "VALIDATION_ERROR",
          message: "El cuerpo de la petición es demasiado grande",
        },
      });
    });
  });

  describe("When an error has a type that is not from the body parser", () => {
    it("Then it is still an unexpected error: 500 and no detail", () => {
      const error = Object.assign(new Error("boom"), { type: "other.thing" });

      handleError(error, req, res, next);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Ha ocurrido un error inesperado",
        },
      });
    });
  });
});
