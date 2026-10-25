import type { HydratedDocument } from "mongoose";
import type { UserDocument } from "../model/User.js";
import {
  DEFAULT_LIBRARY_VIEW,
  type PreferencesDto,
  type UserDto,
} from "../types/types.js";

export const mapPreferencesToDto = (
  user: HydratedDocument<UserDocument>,
): PreferencesDto => ({
  libraryView: user.preferences?.libraryView ?? DEFAULT_LIBRARY_VIEW,
});

// Única frontera por la que un Usuario sale de la capa de persistencia hacia
// la API: passwordHash y los hashes de token nunca se copian aquí.
const mapUserDocumentToDto = (
  user: HydratedDocument<UserDocument>,
): UserDto => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  preferences: mapPreferencesToDto(user),
});

export default mapUserDocumentToDto;
