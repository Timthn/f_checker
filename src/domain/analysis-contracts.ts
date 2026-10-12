import { z } from 'zod';
import { date,searchSchema } from './contracts';
export const meetingSchema=z.object({a:searchSchema,b:searchSchema,arrival_day:date,max_minutes:z.union([z.literal(15),z.literal(30),z.literal(60),z.literal(120),z.literal(240),z.literal(360)]),lock_a:z.uuid().optional()}).refine(v=>v.a.destination===v.b.destination&&v.a.currency===v.b.currency,{message:'SHARED_DESTINATION_CURRENCY'});
export const flexibleSchema=z.object({base:searchSchema,departure_from:date,departure_to:date,return_from:date,return_to:date,min_nights:z.number().int().min(0).max(365),max_nights:z.number().int().min(0).max(365)}).refine(v=>v.departure_from<=v.departure_to&&v.return_from<=v.return_to&&v.min_nights<=v.max_nights,{message:'INVALID_RANGE'});
export type MeetingQuery=z.infer<typeof meetingSchema>;
export type FlexibleQuery=z.infer<typeof flexibleSchema>;
