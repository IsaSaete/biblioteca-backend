import type { Request, Response } from "express";

const checkHealthStatus = (_req: Request, res: Response): void => {
  res.status(200).json({ message: "pong" });
};

export default checkHealthStatus;
