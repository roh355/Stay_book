export const PORT = Number(process.env.PORT) || 3000;
export const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
export const JWT_EXPIRES_IN = "8h";

// Conference operating window: full 24h, 30-min slots
export const DAY_START_MIN = 0;
export const DAY_END_MIN = 1440;
export const SLOT_MIN = 30;
