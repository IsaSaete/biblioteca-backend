import type { Response } from "supertest";

// Lee el valor de una cookie de la cabecera Set-Cookie de una respuesta.
const getCookieValue = (
  response: Response,
  name: string,
): string | undefined => {
  const setCookie = response.get("Set-Cookie") ?? [];
  const cookie = setCookie.find((item) => item.startsWith(`${name}=`));

  return cookie?.split(";")[0].slice(name.length + 1);
};

export default getCookieValue;
