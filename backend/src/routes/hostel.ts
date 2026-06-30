import { Router, Request, Response } from "express";
import prisma from "../prisma";
import { adminOnly } from "../middleware/auth";
import {
  isValidDate,
  dateRange,
  validateDateRange,
  dateRangesOverlap,
  addDaysISO,
  normalizeDescription,
} from "../utils/intervals";
import { AuthedRequest } from "../types";

const router = Router();
const TYPE = "HOSTEL";
const WINDOW_DAYS = 15;

router.get("/floors", async (_req: Request, res: Response) => {
  const rooms = await prisma.room.findMany({
    where: { type: TYPE },
    select: { floor: true },
    distinct: ["floor"],
    orderBy: { floor: "asc" },
  });
  res.json(rooms.map((r) => r.floor));
});

// Rooms on a floor with availability over the bookable window starting at `date`.
router.get("/rooms", async (req: Request, res: Response) => {
  const floor = Number(req.query.floor);
  const date = req.query.date;
  if (!Number.isInteger(floor)) {
    return res.status(400).json({ error: "floor is required" });
  }
  if (!isValidDate(date)) {
    return res.status(400).json({ error: "valid date (YYYY-MM-DD) is required" });
  }

  const windowEnd = addDaysISO(date, WINDOW_DAYS - 1);
  const windowDates = dateRange(date, windowEnd);

  const rooms = await prisma.room.findMany({
    where: { type: TYPE, floor },
    orderBy: { name: "asc" },
    include: {
      hostelBookings: {
        where: { startDate: { lte: windowEnd }, endDate: { gte: date } },
        select: { startDate: true, endDate: true },
      },
    },
  });

  const result = rooms.map((room) => {
    const freeDays = windowDates.filter(
      (d) => !room.hostelBookings.some((b) => b.startDate <= d && b.endDate >= d)
    ).length;
    return {
      id: room.id,
      name: room.name,
      floor: room.floor,
      bookedOnDate: room.hostelBookings.some(
        (b) => b.startDate <= date && b.endDate >= date
      ),
      freeDays,
      windowDays: WINDOW_DAYS,
    };
  });

  return res.json(result);
});

// Bookings for a room overlapping a window [from, to] (for the day timeline).
router.get("/rooms/:id/bookings", async (req: Request, res: Response) => {
  const roomId = Number(req.params.id);
  const from = req.query.from;
  const to = req.query.to;
  if (!Number.isInteger(roomId)) {
    return res.status(400).json({ error: "invalid room id" });
  }
  const rangeErr = validateDateRange(from, to);
  if (rangeErr) return res.status(400).json({ error: rangeErr });

  const room = await prisma.room.findFirst({ where: { id: roomId, type: TYPE } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const bookings = await prisma.hostelBooking.findMany({
    where: {
      roomId,
      startDate: { lte: to as string },
      endDate: { gte: from as string },
    },
    orderBy: { startDate: "asc" },
    include: { admin: { select: { username: true } } },
  });

  return res.json({
    room: { id: room.id, name: room.name, floor: room.floor },
    from,
    to,
    bookings: bookings.map((b) => ({
      id: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
      bookedBy: b.admin.username,
      description: b.description,
    })),
  });
});

// Book a hostel room for a date range (admin only).
router.post("/bookings", adminOnly, async (req: AuthedRequest, res: Response) => {
  const { roomId, startDate, endDate, description } = req.body || {};
  if (!Number.isInteger(roomId)) {
    return res.status(400).json({ error: "roomId is required" });
  }
  const rangeErr = validateDateRange(startDate, endDate);
  if (rangeErr) return res.status(400).json({ error: rangeErr });

  const room = await prisma.room.findFirst({ where: { id: roomId, type: TYPE } });
  if (!room) return res.status(404).json({ error: "Room not found" });

  const existing = await prisma.hostelBooking.findMany({
    where: { roomId },
    select: { startDate: true, endDate: true },
  });
  const conflict = existing.some((b) =>
    dateRangesOverlap(startDate, endDate, b.startDate, b.endDate)
  );
  if (conflict) {
    return res.status(409).json({ error: "Selected days overlap an existing booking" });
  }

  const booking = await prisma.hostelBooking.create({
    data: {
      roomId,
      startDate,
      endDate,
      adminId: req.adminId!,
      description: normalizeDescription(description),
    },
  });

  return res.status(201).json(booking);
});

// Delete a hostel booking (admin only).
router.delete("/bookings/:id", adminOnly, async (req: AuthedRequest, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "invalid booking id" });
  }

  const booking = await prisma.hostelBooking.findUnique({
    where: { id },
    include: { room: { select: { type: true } } },
  });
  if (!booking || booking.room.type !== TYPE) {
    return res.status(404).json({ error: "Booking not found" });
  }

  await prisma.hostelBooking.delete({ where: { id } });
  return res.json({ ok: true });
});

// Search: floors with at least one free room across a date range.
// availableRooms = minimum free rooms on that floor across all days in the range.
router.get("/search", async (req: Request, res: Response) => {
  const from = req.query.from;
  const to = req.query.to;
  const rangeErr = validateDateRange(from, to);
  if (rangeErr) return res.status(400).json({ error: rangeErr });

  const dates = dateRange(from as string, to as string);

  const rooms = await prisma.room.findMany({
    where: { type: TYPE },
    orderBy: [{ floor: "asc" }, { name: "asc" }],
    include: {
      hostelBookings: {
        where: {
          startDate: { lte: to as string },
          endDate: { gte: from as string },
        },
        select: { startDate: true, endDate: true },
      },
    },
  });

  const byFloor = new Map<
    number,
    { floor: number; totalRooms: number; minAvailable: number }
  >();

  for (const room of rooms) {
    if (!byFloor.has(room.floor)) {
      byFloor.set(room.floor, { floor: room.floor, totalRooms: 0, minAvailable: 0 });
    }
    byFloor.get(room.floor)!.totalRooms += 1;
  }

  for (const [floor, entry] of byFloor) {
    const floorRooms = rooms.filter((r) => r.floor === floor);
    let minAvail = entry.totalRooms;

    for (const d of dates) {
      let avail = 0;
      for (const room of floorRooms) {
        const bookedOnDay = room.hostelBookings.some(
          (b) => b.startDate <= d && b.endDate >= d
        );
        if (!bookedOnDay) avail += 1;
      }
      minAvail = Math.min(minAvail, avail);
    }

    entry.minAvailable = minAvail;
  }

  const results = [...byFloor.values()]
    .filter((f) => f.minAvailable > 0)
    .map((f) => ({
      floor: f.floor,
      availableRooms: f.minAvailable,
      totalRooms: f.totalRooms,
    }))
    .sort((a, b) => a.floor - b.floor);

  return res.json({ from, to, results });
});

export default router;
