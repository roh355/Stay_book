export type BookingType = 'CONFERENCE' | 'HOSTEL';

export interface User {
  id: number;
  username: string;
  role: 'admin';
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ConferenceRoom {
  id: number;
  name: string;
  floor: number;
  bookingCount: number;
  fullyBooked: boolean;
}

export interface ConferenceInterval {
  id: number;
  startMin: number;
  endMin: number;
  bookedBy: string;
  description: string | null;
}

export interface ConferenceRoomBookings {
  room: { id: number; name: string; floor: number };
  date: string;
  bookings: ConferenceInterval[];
}

export interface HostelRoom {
  id: number;
  name: string;
  floor: number;
  bookedOnDate: boolean;
  freeDays: number;
  windowDays: number;
}

export interface HostelInterval {
  id: number;
  startDate: string;
  endDate: string;
  bookedBy: string;
  description: string | null;
}

export interface HostelRoomBookings {
  room: { id: number; name: string; floor: number };
  from: string;
  to: string;
  bookings: HostelInterval[];
}

export interface FloorAvailability {
  floor: number;
  availableRooms: number;
  totalRooms: number;
}

export interface ConferenceSearchResult {
  date: string;
  startMin: number;
  endMin: number;
  results: FloorAvailability[];
}

export interface HostelSearchResult {
  from: string;
  to: string;
  results: FloorAvailability[];
}

export interface UpcomingBooking {
  id: number;
  type: BookingType;
  roomId: number;
  roomName: string;
  floor: number;
  date: string;
  endDate: string | null;
  startMin: number | null;
  endMin: number | null;
  description: string | null;
}
