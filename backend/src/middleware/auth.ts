import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config";
import { AuthedRequest } from "../types";

interface TokenPayload {
  adminId: number;
  username: string;
  role: string;
}

function extractToken(req: AuthedRequest): string | null {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Attaches req.admin if a valid token is present; never blocks.
export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
      req.admin = { id: payload.adminId, username: payload.username };
      req.adminId = payload.adminId;
    } catch {
      // ignore invalid token -> treated as guest
    }
  }
  next();
}

// Blocks the request unless a valid admin token is present.
export function adminOnly(req: AuthedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
    req.admin = { id: payload.adminId, username: payload.username };
    req.adminId = payload.adminId;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
