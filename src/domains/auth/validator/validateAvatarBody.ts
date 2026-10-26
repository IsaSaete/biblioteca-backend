import ValidationError from "../../../shared/errors/ValidationError.js";
import { AVATAR_MAX_BYTES } from "../types/types.js";

const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

// El Content-Type lo declara el cliente: la firma del fichero comprueba que
// de verdad es un JPEG antes de guardarlo y servirlo como tal.
const validateAvatarBody = (body: unknown): Buffer => {
  if (!Buffer.isBuffer(body) || body.length === 0) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "La foto debe enviarse como image/jpeg",
      "avatar",
    );
  }

  if (body.length > AVATAR_MAX_BYTES) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "La foto supera los 200 KB",
      "avatar",
    );
  }

  if (!JPEG_SIGNATURE.every((byte, index) => body[index] === byte)) {
    throw new ValidationError(
      "VALIDATION_ERROR",
      "La foto no es un JPEG válido",
      "avatar",
    );
  }

  return body;
};

export default validateAvatarBody;
