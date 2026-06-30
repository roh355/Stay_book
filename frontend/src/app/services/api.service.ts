import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ConferenceRoom,
  ConferenceRoomBookings,
  ConferenceSearchResult,
  HostelRoom,
  HostelRoomBookings,
  HostelSearchResult,
  UpcomingBooking,
} from '../models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ===== Conference =====
  getConferenceFloors(): Observable<number[]> {
    return this.http.get<number[]>('/api/conference/floors');
  }

  getConferenceRooms(floor: number, date: string): Observable<ConferenceRoom[]> {
    const params = new HttpParams().set('floor', floor).set('date', date);
    return this.http.get<ConferenceRoom[]>('/api/conference/rooms', { params });
  }

  getConferenceRoomBookings(roomId: number, date: string): Observable<ConferenceRoomBookings> {
    const params = new HttpParams().set('date', date);
    return this.http.get<ConferenceRoomBookings>(`/api/conference/rooms/${roomId}/bookings`, {
      params,
    });
  }

  createConferenceBooking(
    roomId: number,
    date: string,
    startMin: number,
    endMin: number,
    description?: string | null
  ): Observable<unknown> {
    return this.http.post('/api/conference/bookings', {
      roomId,
      date,
      startMin,
      endMin,
      description: description || null,
    });
  }

  deleteConferenceBooking(id: number): Observable<unknown> {
    return this.http.delete(`/api/conference/bookings/${id}`);
  }

  searchConference(
    date: string,
    startMin: number,
    endMin: number
  ): Observable<ConferenceSearchResult> {
    const params = new HttpParams()
      .set('date', date)
      .set('startMin', startMin)
      .set('endMin', endMin);
    return this.http.get<ConferenceSearchResult>('/api/conference/search', { params });
  }

  // ===== Hostel =====
  getHostelFloors(): Observable<number[]> {
    return this.http.get<number[]>('/api/hostel/floors');
  }

  getHostelRooms(floor: number, date: string): Observable<HostelRoom[]> {
    const params = new HttpParams().set('floor', floor).set('date', date);
    return this.http.get<HostelRoom[]>('/api/hostel/rooms', { params });
  }

  getHostelRoomBookings(roomId: number, from: string, to: string): Observable<HostelRoomBookings> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<HostelRoomBookings>(`/api/hostel/rooms/${roomId}/bookings`, { params });
  }

  createHostelBooking(
    roomId: number,
    startDate: string,
    endDate: string,
    description?: string | null
  ): Observable<unknown> {
    return this.http.post('/api/hostel/bookings', {
      roomId,
      startDate,
      endDate,
      description: description || null,
    });
  }

  deleteHostelBooking(id: number): Observable<unknown> {
    return this.http.delete(`/api/hostel/bookings/${id}`);
  }

  searchHostel(from: string, to: string): Observable<HostelSearchResult> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<HostelSearchResult>('/api/hostel/search', { params });
  }

  // ===== Me =====
  getMyBookings(): Observable<UpcomingBooking[]> {
    return this.http.get<UpcomingBooking[]>('/api/me/bookings');
  }

  deleteBooking(type: 'CONFERENCE' | 'HOSTEL', id: number): Observable<unknown> {
    const base = type === 'CONFERENCE' ? '/api/conference/bookings' : '/api/hostel/bookings';
    return this.http.delete(`${base}/${id}`);
  }
}
