import type { Request, Response } from "express";

const handleEndpointNotFound = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: "ENDPOINT_NOT_FOUND",
      message: `No existe el endpoint ${req.method} ${req.originalUrl}`,
    },
  });
};

export default handleEndpointNotFound;
