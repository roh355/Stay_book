import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { adminOnly } from "../middleware/auth";
import { overlaps, coversFullDay, validateInterval, isValidDate, normalizeDescription } from "../utils/intervals";
import { AuthedRequest } from "../types";

const router = Router();
const TYPE = "CONFERENCE";

// List distinct floors for conference rooms.
router.get("/floors", async (_req: Request, res: Response) => {
  const rooms = await prisma.room.findMany({
    where: { type: TYPE },
    select: { floor: true },
    distinct: ["floor"],
    orderBy: { floor: "asc" },
  });
  res.json(rooms.map((r) => r.floor));
});

// Rooms on a floor with fullyBooked flag for a date.
router.get("/rooms", async (req: Request, res: Response) => {
  const floor = Number(req.query.floor);
  const date = req.query.date;
  if (!Number.isInteger(floor)) {
    return res.status(400).json({ error: "floor is required" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "valid date (YYYY-MM-DD) is required" });
  }

  const rooms = await prisma.room.findMany({
    where: { type: TYPE, floor },
    orderBy: { name: "asc" },
    include: {
      conferenceBookings: {
        where: { date },
        select: { startMin: true, endMin: true },
      },
    },
  });

  const result = rooms.map((room) => ({
    id: room.id,
    name: room.name,
    floor: room.floor,
    bookingCount: room.conferenceBookings.length,
    fullyBooked: coversFullDay(room.conferenceBookings),
  }));

  return res.json(result);
});

// Booked intervals for a specific room/date (for the timeline graph).
router.get("/rooms/:id/bookings", async (req: Request, res: Response) => {
  const roomId = Number(req.params.id);
  const date = req.query.date;
  if (!Number.isInteger(roomId)) {
    return res.status(400).json({ error: "invalid room id" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "valid date (YYYY-MM-DD) is required" });
  }

  const room = await prisma.room.findFirst({ where: { id: roomId, type: TYPE } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const bookings = await prisma.conferenceBooking.findMany({
    where: { roomId, date },
    orderBy: { startMin: "asc" },
    include: { admin: { select: { username: true } } },
  });

  return res.json({
    room: { id: room.id, name: room.name, floor: room.floor },
    date,
    bookings: bookings.map((b) => ({
      id: b.id,
      startMin: b.startMin,
      endMin: b.endMin,
      bookedBy: b.admin.username,
      description: b.description,
    })),
  });
});

// Create a conference booking (admin only).
router.post("/bookings", adminOnly, async (req: AuthedRequest, res: Response) => {
  const { roomId, date, startMin, endMin, description } = req.body || {};
  if (!Number.isInteger(roomId)) {
    return res.status(400).json({ error: "roomId is required" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "valid date (YYYY-MM-DD) is required" });
  }
  const intervalErr = validateInterval(startMin, endMin);
  if (intervalErr) return res.status(400).json({ error: intervalErr });

  const room = await prisma.room.findFirst({ where: { id: roomId, type: TYPE } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const existing = await prisma.conferenceBooking.findMany({
    where: { roomId, date },
    select: { startMin: true, endMin: true },
  });
  const conflict = existing.some((b) => overlaps(startMin, endMin, b.startMin, b.endMin));
  if (conflict) {
    return res.status(409).json({ error: "Time slot overlaps an existing booking" });
  }

  const booking = await prisma.conferenceBooking.create({
    data: {
      roomId,
      date,
      startMin,
      endMin,
      adminId: req.adminId!,
      description: normalizeDescription(description),
    },
  });

  return res.status(201).json(booking);
});

// Delete a conference booking (admin only).
router.delete("/bookings/:id", adminOnly, async (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid booking id" });
  }

  const booking = await prisma.conferenceBooking.findUnique({
    where: { id },
    include: { room: { select: { type: true } } },
  });
  if (!booking || booking.room.type !== TYPE) {
    return res.status(404).json({ error: "Booking not found" });
  }

  await prisma.conferenceBooking.delete({ where: { id } });
  return res.json({ ok: true });
});

// Search: floors with rooms free for a date + time interval.
router.get("/search", async (req: Request, res: Response) => {
  const date = req.query.date;
  const startMin = Number(req.query.startMin);
  const endMin = Number(req.query.endMin);
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "valid date (YYYY-MM-DD) is required" });
  }
  const intervalErr = validateInterval(startMin, endMin);
  if (intervalErr) return res.status(400).json({ error: intervalErr });

  const rooms = await prisma.room.findMany({
    where: { type: TYPE },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
    include: {
      conferenceBookings: {
        where: { date },
        select: { startMin: true, endMin: true },
      },
    },
  });

  const byFloor = new Map<number, { floor: number; availableRooms: number; totalRooms: number }>();
  for (const room of rooms) {
    const free = !room.conferenceBookings.some((b) =>
      overlaps(startMin, endMin, b.startMin, b.endMin)
    );
    if (!byFloor.has(room.floor)) {
      byFloor.set(room.floor, { floor: room.floor, availableRooms: 0, totalRooms: 0 });
    }
    const entry = byFloor.get(room.floor)!;
    entry.totalRooms += 1;
    if (free) entry.availableRooms += 1;
  }

  const results = [...byFloor.values()]
    .filter((f) => f.availableRooms > 0)
    .sort((a, b) => a.floor - b.floor);

  return res.json({ date, startMin, endMin, results });
});

export default router;
