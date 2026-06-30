import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

const CONFERENCE_FLOORS = 5;
const CONFERENCE_ROOMS_PER_FLOOR = 6;
const HOSTEL_FLOORS = 4;
const HOSTEL_ROOMS_PER_FLOOR = 10;

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// Returns YYYY-MM-DD offset from today.
function dateFromToday(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("Seeding database...");

  // Wipe existing data (idempotent reseed)
  await prisma.conferenceBooking.deleteMany();
  await prisma.hostelBooking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.admin.deleteMany();

  // Admin
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const admin = await prisma.admin.create({
    data: { username: ADMIN_USERNAME, passwordHash },
  });
  console.log(`Created admin "${ADMIN_USERNAME}" (password: ${ADMIN_PASSWORD})`);

  // Conference rooms
  const conferenceRooms: { id: number; floor: number; name: string }[] = [];
  for (let floor = 1; floor <= CONFERENCE_FLOORS; floor++) {
    for (let n = 1; n <= CONFERENCE_ROOMS_PER_FLOOR; n++) {
      const room = await prisma.room.create({
        data: { type: "CONFERENCE", floor, name: `C-${floor}-${pad(n)}` },
      });
      conferenceRooms.push(room);
    }
  }

  // Hostel rooms
  const hostelRooms: { id: number; floor: number; name: string }[] = [];
  for (let floor = 1; floor <= HOSTEL_FLOORS; floor++) {
    for (let n = 1; n <= HOSTEL_ROOMS_PER_FLOOR; n++) {
      const room = await prisma.room.create({
        data: { type: "HOSTEL", floor, name: `H-${floor}-${pad(n)}` },
      });
      hostelRooms.push(room);
    }
  }

  console.log(
    `Created ${conferenceRooms.length} conference rooms and ${hostelRooms.length} hostel rooms`
  );

  // Sample conference bookings (future dates, attributed to admin)
  const today = dateFromToday(0);
  const tomorrow = dateFromToday(1);

  // Room 1 (floor 1): a couple of intervals today
  await prisma.conferenceBooking.create({
    data: {
      roomId: conferenceRooms[0].id,
      adminId: admin.id,
      date: today,
      startMin: 9 * 60,
      endMin: 10 * 60,
      description: "Morning standup",
    },
  });
  await prisma.conferenceBooking.create({
    data: { roomId: conferenceRooms[0].id, adminId: admin.id, date: today, startMin: 14 * 60, endMin: 15 * 60 + 30 },
  });

  // Room 2 (floor 1): fully booked today (covers whole 24h)
  await prisma.conferenceBooking.create({
    data: { roomId: conferenceRooms[1].id, adminId: admin.id, date: today, startMin: 0, endMin: 1440 },
  });

  // Room 7 (floor 2): a future booking
  await prisma.conferenceBooking.create({
    data: { roomId: conferenceRooms[6].id, adminId: admin.id, date: tomorrow, startMin: 11 * 60, endMin: 12 * 60 },
  });

  // Sample hostel bookings (date ranges)
  await prisma.hostelBooking.create({
    data: {
      roomId: hostelRooms[0].id,
      adminId: admin.id,
      startDate: today,
      endDate: dateFromToday(2),
      description: "Conference attendees",
    },
  });
  await prisma.hostelBooking.create({
    data: {
      roomId: hostelRooms[1].id,
      adminId: admin.id,
      startDate: today,
      endDate: today,
    },
  });
  await prisma.hostelBooking.create({
    data: {
      roomId: hostelRooms[10].id,
      adminId: admin.id,
      startDate: tomorrow,
      endDate: dateFromToday(5),
      description: "Guest accommodation",
    },
  });

  console.log("Sample bookings created.");
  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
