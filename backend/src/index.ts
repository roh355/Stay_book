import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import { PORT } from "./config";
import { optionalAuth } from "./middleware/auth";

import authRoutes from "./routes/auth";
import conferenceRoutes from "./routes/conference";
import hostelRoutes from "./routes/hostel";
import meRoutes from "./routes/me";

const app = express();

app.use(cors());
app.use(express.json());
app.use(optionalAuth);

app.get("/api/health", (_req: Request, res: Response) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/conference", conferenceRoutes);
app.use("/api/hostel", hostelRoutes);
app.use("/api/me", meRoutes);

// Centralized error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Booking API listening on http://localhost:${PORT}`);
});
