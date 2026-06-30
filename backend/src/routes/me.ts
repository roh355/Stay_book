import { Router, Response } from "express";
import prisma from "../prisma";
import { adminOnly } from "../middleware/auth";
import { AuthedRequest } from "../types";

const router = Router();

// Upcoming bookings created by the logged-in admin (date >= today).
router.get("/bookings", adminOnly, async (req: AuthedRequest, res: Response) => {
  const today = new Date().toISOString().slice(0, 10);
  const adminId = req.adminId!;

  const [conference, hostel] = await Promise.all([
    prisma.conferenceBooking.findMany({
      where: { adminId, date: { gte: today } },
      include: { room: { select: { name: true, floor: true } } },
    }),
    prisma.hostelBooking.findMany({
      where: { adminId, endDate: { gte: today } },
      include: { room: { select: { name: true, floor: true } } },
    }),
  ]);

  const items = [
    ...conference.map((b) => ({
      id: b.id,
      type: "CONFERENCE" as const,
      roomId: b.roomId,
      roomName: b.room.name,
      floor: b.room.floor,
      date: b.date,
      endDate: null as string | null,
      startMin: b.startMin as number | null,
      endMin: b.endMin as number | null,
      description: b.description,
    })),
    ...hostel.map((b) => ({
      id: b.id,
      type: "HOSTEL" as const,
      roomId: b.roomId,
      roomName: b.room.name,
      floor: b.room.floor,
      date: b.startDate,
      endDate: b.endDate as string | null,
      startMin: null as number | null,
      endMin: null as number | null,
      description: b.description,
    })),
  ].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return (a.startMin ?? 0) - (b.startMin ?? 0);
  });

  res.json(items);
});

export default router;
