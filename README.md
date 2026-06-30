# StayBook — Conference & Hostel Booking

A full-stack booking app with two booking types:

- **Conference rooms** — pick a date and floor, open a room to see a 24-hour timeline graph where booked intervals are elevated, then drag across free time (30-minute slots) to book a slot.
- **Hostel rooms** — pick a date and floor, book any available room for the day.

Guests can browse everything read-only; **only admins can book**. There is no signup — an admin account is seeded into the database. Logging in with the seeded credentials grants admin (booking) access.

## Tech stack

- **Frontend:** Angular 19 (standalone components, signals), plain CSS, light/dark theme
- **Backend:** Node.js + Express (TypeScript)
- **Database:** SQLite via Prisma
- **Auth:** JWT + bcrypt

## Features

- Two tabs: Conference and Hostel
- Light/dark mode toggle (sun/moon icon, persisted, respects OS preference)
- Profile page showing your identity and, for admins, a list of upcoming bookings (clickable — jumps to the room/floor/date)
- Booking sidebar with calendar, floor dropdown, and Prev/Next floor + Prev/Next date buttons
- Room grid with fully-booked rooms shown in red as "Not available"
- Draggable conference timeline graph (booked = elevated, free = selectable)
- Search:
  - Conference: by date + time interval → floors with available rooms
  - Hostel: by date → floors with available rooms
  - Search results are clickable and navigate to the room grid

## Project structure

```
backend/    Express + Prisma API (TypeScript)
frontend/   Angular 19 app
```

## Getting started

### 1. Backend

```bash
cd backend
npm install
npx prisma migrate dev --name init   # creates SQLite DB + runs seed
npm run dev                           # http://localhost:3000
```

If the database already exists and you only want to reseed:

```bash
npm run seed
```

### 2. Frontend

```bash
cd frontend
npm install
npm start                             # http://localhost:4200
```

The dev server proxies `/api` to the backend on port 3000 (see `frontend/proxy.conf.json`).

Open http://localhost:4200.

## Admin credentials (seeded)

```
username: admin
password: admin123
```

Sign in via the "Sign in" button in the top bar. While signed out you can browse all availability, but Book actions are disabled.

## Seeded data

- Conference: 5 floors × 6 rooms (30 rooms)
- Hostel: 4 floors × 10 rooms (40 rooms)
- A few sample bookings (today and tomorrow) so the timeline, red "Not available" states, and the profile upcoming-bookings list are populated.

## API overview

| Method | Endpoint | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/login` | public | Admin login → JWT |
| GET | `/api/conference/floors` | public | Conference floors |
| GET | `/api/conference/rooms?floor=&date=` | public | Rooms + `fullyBooked` flag |
| GET | `/api/conference/rooms/:id/bookings?date=` | public | Booked intervals for the timeline |
| POST | `/api/conference/bookings` | admin | Create a conference booking |
| GET | `/api/conference/search?date=&startMin=&endMin=` | public | Floors with free rooms for an interval |
| GET | `/api/hostel/floors` | public | Hostel floors |
| GET | `/api/hostel/rooms?floor=&date=` | public | Rooms + `booked` flag |
| POST | `/api/hostel/bookings` | admin | Book a room for a day |
| GET | `/api/hostel/search?date=` | public | Floors with free rooms |
| GET | `/api/me/bookings` | admin | The admin's upcoming bookings |

Times are stored as minutes from midnight in 30-minute slots (0–1440).
