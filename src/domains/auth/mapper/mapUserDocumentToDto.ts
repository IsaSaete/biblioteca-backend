import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../model/User.js";
import type { UserDto } from "../types/types.js";

// Única frontera por la que un Usuario sale de la capa de persistencia hacia
// la API: passwordHash y los hashes de token nunca se copian aquí.
const mapUserDocumentToDto = (
  user: HydratedDocument<UserDocument>,
): UserDto => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
});

export default mapUserDocumentToDto;
