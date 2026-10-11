import { NextResponse } from 'next/server';
import fixture from '../../../../../docs/connectors/fixtures/apify-build-0.0.2/economy-one-way.json';
import dates from '../../../../../docs/connectors/fixtures/apify-build-0.0.2/calendar.json';
import { parseSearch,parseCalendar } from '@/connectors/apify-adapter';
export const runtime='nodejs';
export function GET(){return NextResponse.json({evidence_kind:'live_derived_redacted_sample',offers:parseSearch(fixture.provider_response,{origin:'HKG',destination:'NRT',departure:'2026-11-10',adults:1,cabin:'economy',currency:'HKD',carry_on:0,checked:0}),cells:parseCalendar(dates.provider_response),source_count:126},{headers:{'Cache-Control':'no-store'}});}
