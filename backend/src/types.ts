import { Request } from "express";

export interface AuthInfo {
  id: number;
  username: string;
}

export interface AuthedRequest extends Request {
  admin?: AuthInfo;
  adminId?: number;
}
