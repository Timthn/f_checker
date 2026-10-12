import { z } from 'zod';
export const date = z.iso.date();
export const searchSchema = z.object({
  origin: z.string().regex(/^[A-Z]{3}$/), destination: z.string().regex(/^[A-Z]{3}$/),
  departure: date, return_date: date.optional(), cabin: z.enum(['economy','business']),
  adults: z.number().int().min(1).max(6), currency: z.enum(['HKD','USD','EUR','JPY']),
  carry_on: z.number().int().min(0).max(1), checked: z.number().int().min(0).max(2),
}).refine(v => v.origin !== v.destination, {path:['destination'],message:'SAME_AIRPORT'});
// Different airport-local dates cannot establish chronological order across the date line.
// Complete itinerary validation must use verified UTC and destination-local nights.
export type Search = z.infer<typeof searchSchema>;
export type Money = {minor: number; currency: string; digits: number};
export type Segment = {leg_index:number; from: string; to: string; departure_local: string; arrival_local: string; departure_utc: string|null; arrival_utc: string|null; arrival_zone: string|null; flight: string; cabin: string; duration: number};
export type BagEvidence = {segment: number; passenger: number; carry_on: number|null; checked: number|null; carry_kg: number|null; checked_kg: number|null; source: string; contradictory: boolean};
export type Offer = {offer_id: string; itinerary_id: string; comparison_key: string|null; money: Money; segments: Segment[]; baggage: BagEvidence[]; complete: boolean; price_complete:boolean; quoted_adults:number|null; duration_minutes:number|null; fare_identity: string|null; source: string; observed_at: string; expires_at: string; time_verified: boolean};
export type Observation = {comparison_key: string; observed_at: string; minor: number; currency: string; fresh: boolean};
export type CalendarCell = {departure: string; return_date: string|null; money: Money|null; state: 'coarse'|'verified'|'unknown'|'failed'; offer_id?: string; evidence_reason?:'price_display_conflict'|'unreadable_display_price'};
