import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, ADMIN_IDS } from '@/lib/auth';
import { db } from '@/db';
import { tournaments, tournamentGroups, groupTeams, matches, teams } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Stadium data by country
const GROUNDS_DATA: Record<string, { name: string; city: string }[]> = {
  'West Indies': [
    { name: 'Brian Lara Stadium', city: 'San Fernando' },
    { name: 'Daren Sammy Cricket Ground', city: 'Gros Islet' },
    { name: 'Kensington Oval', city: 'Bridgetown' },
    { name: 'Providence Stadium', city: 'Georgetown' },
    { name: "Queen's Park Oval", city: 'Port of Spain' },
    { name: 'Sabina Park', city: 'Kingston' },
    { name: 'Sir Vivian Richards Stadium', city: "St John's" },
    { name: 'Warner Park', city: 'Basseterre' },
  ],
  'Pakistan': [
    { name: 'Gaddafi Stadium', city: 'Lahore' },
    { name: 'Multan Cricket Stadium', city: 'Multan' },
    { name: 'National Stadium', city: 'Karachi' },
    { name: 'Rawalpindi Cricket Stadium', city: 'Rawalpindi' },
  ],
  'New Zealand': [
    { name: 'Basin Reserve', city: 'Wellington' },
    { name: 'Bay Oval', city: 'Mt Maunganui' },
    { name: 'Eden Park', city: 'Auckland' },
    { name: 'Hagley Oval', city: 'Christchurch' },
    { name: 'McLean Park', city: 'Napier' },
    { name: 'University of Otago Oval', city: 'Otago' },
  ],
  'India': [
    { name: 'ACA Stadium', city: 'Guwahati' },
    { name: 'ACA-VDCA Cricket Stadium', city: 'Visakhapatnam' },
    { name: 'Arun Jaitley Cricket Stadium', city: 'New Delhi' },
    { name: 'BRSABV Ekana Cricket Stadium', city: 'Lucknow' },
    { name: 'Eden Gardens', city: 'Kolkata' },
    { name: 'HPCA Stadium', city: 'Dharamshala' },
    { name: 'MA Chidambaram Stadium', city: 'Chennai' },
    { name: 'Mullanpur Stadium', city: 'Chandigarh' },
    { name: 'Narendra Modi Stadium', city: 'Ahmedabad' },
    { name: 'Rajiv Gandhi International Stadium', city: 'Hyderabad' },
    { name: 'Sawai Mansingh Stadium', city: 'Jaipur' },
    { name: 'Wankhede Stadium', city: 'Mumbai' },
  ],
  'England': [
    { name: 'Edgbaston', city: 'Birmingham' },
    { name: 'Emirates Old Trafford', city: 'Manchester' },
    { name: 'Headingley', city: 'Leeds' },
    { name: 'Kia Oval', city: 'London' },
    { name: "Lord's", city: 'London' },

    { name: 'Sophia Gardens', city: 'Cardiff' },
    { name: 'Trent Bridge', city: 'Nottingham' },



  ],
  'Australia': [
    { name: 'Adelaide Oval', city: 'Adelaide' },
    { name: 'Bellerive Oval', city: 'Hobart' },
    { name: 'The Gabba', city: 'Brisbane' },
    { name: 'Melbourne Cricket Ground', city: 'Melbourne' },
    { name: 'Perth Stadium', city: 'Perth' },
    { name: 'Sydney Cricket Ground', city: 'Sydney' },
    { name: 'Allan Border Field', city: 'Brisbane' },

    { name: 'Coffs Harbour', city: 'Coffs Harbour' },
    { name: 'Docklands Stadium', city: 'Melbourne' },
    { name: 'GMHBA Stadium', city: 'Geelong' },
    { name: 'Great Barrier Reef Arena', city: 'Brisbane' },
    { name: 'Junction Oval', city: 'Melbourne' },

  ],
};

// Weighted probability types
type WeightedOptions = Record<string, number>;
interface VenueProfile {
  pitchType: WeightedOptions;
  surface: WeightedOptions;
  cracks: WeightedOptions;
}

// Default regional crack distributions
const SUBCONTINENT_WI_CRACKS: WeightedOptions = { 'Light': 40, 'Heavy': 40, 'None': 20 };
const AUS_ENG_NZ_CRACKS: WeightedOptions = { 'None': 50, 'Light': 40, 'Heavy': 10 };

// Comprehensive venue profiles with realistic weighted probabilities
const VENUE_PROFILES: Record<string, VenueProfile> = {
  // ============ INDIA ============
  'MA Chidambaram Stadium': { // Chennai - historically spin-friendly, dry
    pitchType: { 'Dusty': 40, 'Dry': 35, 'Standard': 20, 'Grassy/Dusty': 5 },
    surface: { 'Soft': 35, 'Medium': 55, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Wankhede Stadium': { // Mumbai - traditionally good for batting, some pace
    pitchType: { 'Standard': 40, 'Grassy': 25, 'Dry': 25, 'Dusty': 10 },
    surface: { 'Medium': 50, 'Hard': 35, 'Soft': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Eden Gardens': { // Kolkata - balanced, can offer swing early
    pitchType: { 'Standard': 45, 'Grassy': 25, 'Dry': 20, 'Dusty': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Arun Jaitley Cricket Stadium': { // Delhi - dry, spin later
    pitchType: { 'Dry': 40, 'Dusty': 30, 'Standard': 25, 'Grassy/Dusty': 5 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Narendra Modi Stadium': { // Ahmedabad - can be very spin-friendly
    pitchType: { 'Dusty': 45, 'Dry': 30, 'Standard': 20, 'Grassy/Dusty': 5 },
    surface: { 'Soft': 40, 'Medium': 50, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'HPCA Stadium': { // Dharamshala - mountain venue, grassy
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: { 'None': 40, 'Light': 40, 'Heavy': 20 }, // Less cracks due to climate
  },
  'Rajiv Gandhi International Stadium': { // Hyderabad - balanced
    pitchType: { 'Standard': 40, 'Dry': 30, 'Dusty': 20, 'Grassy': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'ACA-VDCA Cricket Stadium': { // Visakhapatnam - good batting surface
    pitchType: { 'Standard': 45, 'Dry': 30, 'Dusty': 15, 'Grassy': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Sawai Mansingh Stadium': { // Jaipur - dry, spin-friendly
    pitchType: { 'Dry': 40, 'Dusty': 35, 'Standard': 20, 'Grassy/Dusty': 5 },
    surface: { 'Soft': 40, 'Medium': 50, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'BRSABV Ekana Cricket Stadium': { // Lucknow - newer venue, balanced
    pitchType: { 'Standard': 40, 'Dry': 30, 'Dusty': 20, 'Grassy': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'ACA Stadium': { // Guwahati - can have some grass
    pitchType: { 'Standard': 35, 'Grassy': 30, 'Dry': 25, 'Grassy/Dry': 10 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Mullanpur Stadium': { // Chandigarh - newer venue
    pitchType: { 'Standard': 40, 'Grassy': 25, 'Dry': 25, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },

  // ============ PAKISTAN ============
  'National Stadium': { // Karachi - traditionally flat, batting paradise
    pitchType: { 'Standard': 50, 'Dry': 30, 'Dusty': 15, 'Grassy': 5 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Gaddafi Stadium': { // Lahore - can offer something for everyone
    pitchType: { 'Standard': 35, 'Dry': 35, 'Dusty': 20, 'Grassy': 10 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Rawalpindi Cricket Stadium': { // Rawalpindi - some grass, pace friendly
    pitchType: { 'Grassy': 40, 'Standard': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 50, 'Hard': 30, 'Soft': 20 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Multan Cricket Stadium': { // Multan - very spin-friendly, dry
    pitchType: { 'Dusty': 45, 'Dry': 35, 'Standard': 15, 'Grassy/Dusty': 5 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },

  // ============ AUSTRALIA ============
  'Perth Stadium': { // Perth - fast, bouncy, pace heaven
    pitchType: { 'Grassy': 55, 'Standard': 25, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Hard': 60, 'Medium': 35, 'Soft': 5 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'The Gabba': { // Brisbane - fast, bouncy, pace friendly
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Hard': 55, 'Medium': 40, 'Soft': 5 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Melbourne Cricket Ground': { // MCG - traditionally seaming, can be flat
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 50, 'Hard': 40, 'Soft': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Sydney Cricket Ground': { // SCG - spin later, traditional pitch
    pitchType: { 'Standard': 35, 'Dry': 30, 'Grassy': 20, 'Dusty': 15 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: { 'None': 40, 'Light': 45, 'Heavy': 15 }, // SCG can crack more
  },
  'Adelaide Oval': { // Adelaide - day/night tests, good for batting
    pitchType: { 'Standard': 45, 'Grassy': 30, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 30, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Bellerive Oval': { // Hobart - seaming conditions
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Medium': 50, 'Hard': 35, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  // Default Australian venues
  'Allan Border Field': {
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 50, 'Hard': 35, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Coffs Harbour': {
    pitchType: { 'Standard': 45, 'Grassy': 30, 'Dry': 15, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 25, 'Soft': 20 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Docklands Stadium': {
    pitchType: { 'Standard': 50, 'Grassy': 25, 'Dry': 15, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 30, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'GMHBA Stadium': {
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 50, 'Hard': 35, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Great Barrier Reef Arena': {
    pitchType: { 'Standard': 40, 'Grassy': 30, 'Dry': 20, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 30, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Junction Oval': {
    pitchType: { 'Standard': 45, 'Grassy': 30, 'Dry': 15, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 25, 'Soft': 20 },
    cracks: AUS_ENG_NZ_CRACKS,
  },

  // ============ ENGLAND ============
  "Lord's": { // Lord's - slope, traditional, seaming
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Soft': 40, 'Medium': 50, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Headingley': { // Leeds - green seamer, swing heaven
    pitchType: { 'Grassy': 60, 'Grassy/Dry': 20, 'Standard': 15, 'Dry': 5 },
    surface: { 'Soft': 50, 'Medium': 40, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Edgbaston': { // Birmingham - good contest, some pace
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Kia Oval': { // London - can turn later, balanced
    pitchType: { 'Standard': 40, 'Grassy': 25, 'Dry': 25, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: { 'None': 45, 'Light': 40, 'Heavy': 15 }, // Oval can crack
  },
  'Emirates Old Trafford': { // Manchester - can spin later
    pitchType: { 'Standard': 35, 'Grassy': 30, 'Dry': 25, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Trent Bridge': { // Nottingham - seaming, swing
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Sophia Gardens': { // Cardiff - balanced
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },

  // ============ NEW ZEALAND ============
  'Basin Reserve': { // Wellington - windy, seaming
    pitchType: { 'Grassy': 55, 'Standard': 25, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Hagley Oval': { // Christchurch - green, seaming
    pitchType: { 'Grassy': 60, 'Standard': 25, 'Grassy/Dry': 10, 'Dry': 5 },
    surface: { 'Soft': 50, 'Medium': 40, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Eden Park': { // Auckland - balanced
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'Bay Oval': { // Mt Maunganui - good batting
    pitchType: { 'Standard': 45, 'Grassy': 30, 'Dry': 15, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'McLean Park': { // Napier
    pitchType: { 'Standard': 40, 'Grassy': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'University of Otago Oval': { // Otago
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },

  // ============ WEST INDIES ============
  'Sabina Park': { // Kingston, Jamaica - fast, bouncy
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Hard': 50, 'Medium': 40, 'Soft': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Kensington Oval': { // Barbados - good batting, some pace
    pitchType: { 'Standard': 45, 'Grassy': 30, 'Dry': 15, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Hard': 30, 'Soft': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  "Queen's Park Oval": { // Trinidad - can spin
    pitchType: { 'Standard': 35, 'Dry': 35, 'Dusty': 20, 'Grassy': 10 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Providence Stadium': { // Guyana - low, slow
    pitchType: { 'Standard': 40, 'Dry': 35, 'Dusty': 15, 'Grassy': 10 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Sir Vivian Richards Stadium': { // Antigua - flat batting track
    pitchType: { 'Standard': 50, 'Dry': 25, 'Grassy': 15, 'Dusty': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Brian Lara Stadium': { // Trinidad
    pitchType: { 'Standard': 40, 'Dry': 30, 'Grassy': 20, 'Dusty': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Daren Sammy Cricket Ground': { // St Lucia
    pitchType: { 'Standard': 45, 'Grassy': 25, 'Dry': 20, 'Grassy/Dry': 10 },
    surface: { 'Medium': 55, 'Soft': 30, 'Hard': 15 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Warner Park': { // St Kitts
    pitchType: { 'Standard': 45, 'Dry': 25, 'Grassy': 20, 'Dusty': 10 },
    surface: { 'Medium': 55, 'Soft': 35, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
};

// Default profiles for regions (fallback if venue not found)
const DEFAULT_PROFILES: Record<string, VenueProfile> = {
  'India': {
    pitchType: { 'Standard': 30, 'Dry': 30, 'Dusty': 25, 'Grassy': 10, 'Grassy/Dusty': 5 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Pakistan': {
    pitchType: { 'Standard': 35, 'Dry': 30, 'Dusty': 25, 'Grassy': 10 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
  'Australia': {
    pitchType: { 'Grassy': 40, 'Standard': 35, 'Grassy/Dry': 15, 'Dry': 10 },
    surface: { 'Medium': 45, 'Hard': 40, 'Soft': 15 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'England': {
    pitchType: { 'Grassy': 45, 'Standard': 35, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Medium': 50, 'Soft': 40, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'New Zealand': {
    pitchType: { 'Grassy': 50, 'Standard': 30, 'Grassy/Dry': 15, 'Dry': 5 },
    surface: { 'Soft': 45, 'Medium': 45, 'Hard': 10 },
    cracks: AUS_ENG_NZ_CRACKS,
  },
  'West Indies': {
    pitchType: { 'Standard': 40, 'Grassy': 25, 'Dry': 25, 'Dusty': 10 },
    surface: { 'Medium': 50, 'Hard': 30, 'Soft': 20 },
    cracks: SUBCONTINENT_WI_CRACKS,
  },
};

// Weighted random selection function
function weightedRandom(weights: WeightedOptions): string {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [_, weight]) => sum + weight, 0);
  let random = Math.random() * total;
  
  for (const [option, weight] of entries) {
    random -= weight;
    if (random <= 0) return option;
  }
  
  return entries[0][0]; // Fallback
}

// Get venue profile (with fallback to country default)
function getVenueProfile(venueName: string, country: string): VenueProfile {
  // Check for exact venue match
  if (VENUE_PROFILES[venueName]) {
    return VENUE_PROFILES[venueName];
  }
  
  // Fallback to country default
  return DEFAULT_PROFILES[country] || DEFAULT_PROFILES['England'];
}

// Generate realistic pitch conditions for a venue
function generatePitchConditions(venueName: string, country: string): { pitchType: string; pitchSurface: string; cracks: string } {
  const profile = getVenueProfile(venueName, country);
  
  return {
    pitchType: weightedRandom(profile.pitchType),
    pitchSurface: weightedRandom(profile.surface),
    cracks: weightedRandom(profile.cracks),
  };
}

const PITCH_TYPES = ['Standard', 'Grassy', 'Dry', 'Grassy/Dry', 'Grassy/Dusty', 'Dusty'];
const PITCH_SURFACES = ['Soft', 'Medium', 'Hard'];
const CRACKS = ['None', 'Light', 'Heavy'];

// GET - Fetch tournaments and matches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const tournamentId = searchParams.get('tournamentId');

    if (type === 'countries') {
      return NextResponse.json(Object.keys(GROUNDS_DATA));
    }

    if (type === 'grounds') {
      const country = searchParams.get('country');
      if (country && GROUNDS_DATA[country]) {
        return NextResponse.json(GROUNDS_DATA[country]);
      }
      return NextResponse.json(GROUNDS_DATA);
    }

    if (type === 'conditions') {
      return NextResponse.json({
        pitchTypes: PITCH_TYPES,
        pitchSurfaces: PITCH_SURFACES,
        cracks: CRACKS,
      });
    }

    // Generate realistic conditions for a specific venue
    if (type === 'venue_conditions') {
      const venue = searchParams.get('venue');
      const country = searchParams.get('country');
      
      if (!venue || !country) {
        return NextResponse.json({ error: 'Venue and country required' }, { status: 400 });
      }
      
      const conditions = generatePitchConditions(venue, country);
      return NextResponse.json(conditions);
    }

    // Get venue profiles for frontend use
    if (type === 'venue_profiles') {
      const country = searchParams.get('country');
      
      if (country) {
        const countryVenues = GROUNDS_DATA[country] || [];
        const profiles: Record<string, VenueProfile> = {};
        
        for (const venue of countryVenues) {
          profiles[venue.name] = getVenueProfile(venue.name, country);
        }
        
        return NextResponse.json({
          defaultProfile: DEFAULT_PROFILES[country] || DEFAULT_PROFILES['England'],
          venueProfiles: profiles,
        });
      }
      
      return NextResponse.json({
        defaultProfiles: DEFAULT_PROFILES,
        venueProfiles: VENUE_PROFILES,
      });
    }

    if (type === 'tournament' && tournamentId) {
      const tournament = await db.select()
        .from(tournaments)
        .where(eq(tournaments.id, parseInt(tournamentId)));

      if (tournament.length === 0) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }

      const groups = await db.select()
        .from(tournamentGroups)
        .where(eq(tournamentGroups.tournamentId, parseInt(tournamentId)));

      const allGroupTeams = await db.select()
        .from(groupTeams)
        .innerJoin(teams, eq(groupTeams.teamId, teams.id));

      const tournamentMatches = await db.select()
        .from(matches)
        .where(eq(matches.tournamentId, parseInt(tournamentId)));

      const allTeams = await db.select().from(teams);

      // Enrich matches with team names
      const enrichedMatches = tournamentMatches.map(match => ({
        ...match,
        team1Name: allTeams.find(t => t.id === match.team1Id)?.name || 'TBD',
        team2Name: allTeams.find(t => t.id === match.team2Id)?.name || 'TBD',
      }));

      // Organize groups with their teams
      const enrichedGroups = groups.map(group => ({
        ...group,
        teams: allGroupTeams
          .filter(gt => gt.group_teams.groupId === group.id)
          .map(gt => ({
            ...gt.group_teams,
            teamName: gt.teams.name,
          }))
          .sort((a, b) => (b.points || 0) - (a.points || 0) || (b.nrr || 0) - (a.nrr || 0)),
      }));

      return NextResponse.json({
        tournament: tournament[0],
        groups: enrichedGroups,
        matches: enrichedMatches,
      });
    }

    // Get all tournaments with basic info
    const allTournaments = await db.select().from(tournaments);
    
    // Get match counts for each tournament
    const enrichedTournaments = await Promise.all(
      allTournaments.map(async (t) => {
        const matchCount = await db.select()
          .from(matches)
          .where(eq(matches.tournamentId, t.id));
        
        const completedCount = matchCount.filter(m => m.status === 'completed').length;
        
        return {
          ...t,
          totalMatches: matchCount.length,
          completedMatches: completedCount,
        };
      })
    );

    return NextResponse.json(enrichedTournaments);
  } catch (error) {
    console.error('Error fetching fixtures:', error);
    return NextResponse.json({ error: 'Failed to fetch fixtures' }, { status: 500 });
  }
}

// POST - Create tournament and generate fixtures
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      name, 
      country, 
      selectedTeamIds, 
      numberOfGroups, 
      roundRobinType,
      matchSchedule // Array of { team1Id, team2Id, venue, city, matchDate, matchTime, pitchType, pitchSurface, cracks }
    } = body;

    if (!name || !country || !selectedTeamIds || selectedTeamIds.length < 2) {
      return NextResponse.json({ error: 'Invalid tournament data' }, { status: 400 });
    }

    // Create tournament
    const newTournament = await db.insert(tournaments).values({
      name,
      country,
      numberOfGroups: numberOfGroups || 1,
      roundRobinType: roundRobinType || 'single',
      status: 'upcoming',
      createdAt: new Date().toISOString(),
    }).returning();

    const tournamentId = newTournament[0].id;

    // Create groups
    const groupNames = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
    const createdGroups: any[] = [];
    
    for (let i = 0; i < numberOfGroups; i++) {
      const group = await db.insert(tournamentGroups).values({
        tournamentId,
        name: numberOfGroups > 1 ? `Group ${groupNames[i]}` : 'League',
        orderIndex: i,
      }).returning();
      createdGroups.push(group[0]);
    }

    // Distribute teams to groups
    const teamsPerGroup = Math.ceil(selectedTeamIds.length / numberOfGroups);
    for (let i = 0; i < selectedTeamIds.length; i++) {
      const groupIndex = Math.floor(i / teamsPerGroup);
      const group = createdGroups[Math.min(groupIndex, createdGroups.length - 1)];
      
      await db.insert(groupTeams).values({
        groupId: group.id,
        teamId: selectedTeamIds[i],
        played: 0,
        won: 0,
        lost: 0,
        tied: 0,
        nrr: 0,
        points: 0,
      });
    }

    // If matchSchedule provided, create matches from it
    if (matchSchedule && matchSchedule.length > 0) {
      for (let i = 0; i < matchSchedule.length; i++) {
        const match = matchSchedule[i];
        
        // Find which group this match belongs to
        let matchGroupId = null;
        for (const group of createdGroups) {
          const teamsInGroup = await db.select()
            .from(groupTeams)
            .where(eq(groupTeams.groupId, group.id));
          
          const teamIds = teamsInGroup.map(t => t.teamId);
          if (teamIds.includes(match.team1Id) && teamIds.includes(match.team2Id)) {
            matchGroupId = group.id;
            break;
          }
        }

        await db.insert(matches).values({
          tournamentId,
          groupId: matchGroupId,
          matchNumber: i + 1,
          team1Id: match.team1Id,
          team2Id: match.team2Id,
          venue: match.venue,
          city: match.city,
          matchDate: match.matchDate || null,
          matchTime: match.matchTime || null,
          pitchType: match.pitchType || 'Standard',
          pitchSurface: match.pitchSurface || 'Medium',
          cracks: match.cracks || 'None',
          status: 'upcoming',
        });
      }
    } else {
      // Auto-generate round-robin fixtures
      const grounds = GROUNDS_DATA[country] || [];
      let matchNumber = 1;

      for (const group of createdGroups) {
        const teamsInGroup = await db.select()
          .from(groupTeams)
          .where(eq(groupTeams.groupId, group.id));
        
        const teamIds = teamsInGroup.map(t => t.teamId);
        
        // Generate round-robin matches
        const matchPairs: { team1Id: number; team2Id: number }[] = [];
        
        for (let i = 0; i < teamIds.length; i++) {
          for (let j = i + 1; j < teamIds.length; j++) {
            matchPairs.push({ team1Id: teamIds[i]!, team2Id: teamIds[j]! });
            
            // If double round-robin, add reverse fixture
            if (roundRobinType === 'double') {
              matchPairs.push({ team1Id: teamIds[j]!, team2Id: teamIds[i]! });
            }
          }
        }

        // Create matches
        for (const pair of matchPairs) {
          const groundIndex = (matchNumber - 1) % grounds.length;
          const ground = grounds[groundIndex] || { name: 'TBD', city: 'TBD' };
          
          await db.insert(matches).values({
            tournamentId,
            groupId: group.id,
            matchNumber,
            team1Id: pair.team1Id,
            team2Id: pair.team2Id,
            venue: ground.name,
            city: ground.city,
            pitchType: PITCH_TYPES[Math.floor(Math.random() * PITCH_TYPES.length)],
            pitchSurface: PITCH_SURFACES[Math.floor(Math.random() * PITCH_SURFACES.length)],
            cracks: CRACKS[Math.floor(Math.random() * CRACKS.length)],
            status: 'upcoming',
          });
          
          matchNumber++;
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      tournamentId,
      message: 'Tournament created successfully'
    });
  } catch (error) {
    console.error('Error creating tournament:', error);
    return NextResponse.json({ error: 'Failed to create tournament' }, { status: 500 });
  }
}

// PUT - Update match result or tournament
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      matchId, 
      action,
      // For result updates
      team1Score, 
      team2Score, 
      winnerId, 
      result, 
      status,
      // For fixture edits
      venue,
      city,
      matchDate,
      matchTime,
      pitchType,
      pitchSurface,
      cracks,
      // For Discord
      tournamentId,
    } = body;

    // Action: Send fixtures to Discord
    if (action === 'send_to_discord' && tournamentId) {
      const webhookUrl = process.env.DISCORD_FIXTURES_WEBHOOK_URL;
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Discord webhook not configured. Add DISCORD_FIXTURES_WEBHOOK_URL to environment variables.' }, { status: 400 });
      }

      // Get tournament details
      const tournament = await db.select().from(tournaments).where(eq(tournaments.id, tournamentId));
      if (tournament.length === 0) {
        return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
      }

      // Get all matches
      const tournamentMatches = await db.select().from(matches).where(eq(matches.tournamentId, tournamentId));
      const allTeams = await db.select().from(teams);

      // Build fixture list
      const fixtureLines = tournamentMatches.map(match => {
        const team1 = allTeams.find(t => t.id === match.team1Id)?.name || 'TBD';
        const team2 = allTeams.find(t => t.id === match.team2Id)?.name || 'TBD';
        const statusEmoji = match.status === 'completed' ? '✅' : match.status === 'live' ? '🔴' : '📅';
        
        let line = `${statusEmoji} **Match ${match.matchNumber}:** ${team1} vs ${team2}`;
        line += `\n   📍 ${match.venue}${match.city ? `, ${match.city}` : ''}`;
        
        if (match.matchDate || match.matchTime) {
          line += `\n   🗓️ ${match.matchDate || 'TBD'} ${match.matchTime || ''}`;
        }
        
        if (match.pitchType) {
          line += `\n   🏟️ ${match.pitchType} | ${match.pitchSurface || 'Medium'} | Cracks: ${match.cracks || 'None'}`;
        }
        
        if (match.status === 'completed' && match.result) {
          line += `\n   🏆 ${match.result}`;
        }
        
        return line;
      });

      // Split into chunks if too long (Discord limit is 4096 for embed description)
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < fixtureLines.length; i += chunkSize) {
        chunks.push(fixtureLines.slice(i, i + chunkSize));
      }

      // Send embeds
      for (let i = 0; i < chunks.length; i++) {
        const embed = {
          title: i === 0 ? `🏏 ${tournament[0].name} - Fixtures` : `🏏 Fixtures (continued)`,
          description: chunks[i].join('\n\n'),
          color: 0x00d4aa,
          footer: {
            text: `${tournament[0].country} • ${tournament[0].roundRobinType === 'double' ? 'Double' : 'Single'} Round Robin • Page ${i + 1}/${chunks.length}`,
          },
          timestamp: new Date().toISOString(),
        };

        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        });

        // Small delay between messages
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      return NextResponse.json({ success: true, message: `Fixtures sent to Discord (${chunks.length} message(s))` });
    }

    // Action: Edit fixture details
    if (action === 'edit_fixture' && matchId) {
      const updateData: any = {};
      if (venue !== undefined) updateData.venue = venue;
      if (city !== undefined) updateData.city = city;
      if (matchDate !== undefined) updateData.matchDate = matchDate;
      if (matchTime !== undefined) updateData.matchTime = matchTime;
      if (pitchType !== undefined) updateData.pitchType = pitchType;
      if (pitchSurface !== undefined) updateData.pitchSurface = pitchSurface;
      if (cracks !== undefined) updateData.cracks = cracks;

      await db.update(matches).set(updateData).where(eq(matches.id, matchId));

      return NextResponse.json({ success: true, message: 'Fixture updated' });
    }

    // Default action: Update match result
    if (!matchId) {
      return NextResponse.json({ error: 'Match ID required' }, { status: 400 });
    }

    // Update match
    await db.update(matches)
      .set({
        team1Score,
        team2Score,
        winnerId,
        result,
        status: status || 'completed',
      })
      .where(eq(matches.id, matchId));

    // Update group standings if match is completed
    if (status === 'completed' && winnerId) {
      const match = await db.select().from(matches).where(eq(matches.id, matchId));
      if (match.length > 0 && match[0].groupId) {
        const groupId = match[0].groupId;
        const team1Id = match[0].team1Id;
        const team2Id = match[0].team2Id;

        // Update winner stats
        const winnerTeam = await db.select()
          .from(groupTeams)
          .where(and(
            eq(groupTeams.groupId, groupId),
            eq(groupTeams.teamId, winnerId)
          ));
        
        if (winnerTeam.length > 0) {
          await db.update(groupTeams)
            .set({
              played: (winnerTeam[0].played || 0) + 1,
              won: (winnerTeam[0].won || 0) + 1,
              points: (winnerTeam[0].points || 0) + 2,
            })
            .where(eq(groupTeams.id, winnerTeam[0].id));
        }

        // Update loser stats
        const loserId = winnerId === team1Id ? team2Id : team1Id;
        const loserTeam = await db.select()
          .from(groupTeams)
          .where(and(
            eq(groupTeams.groupId, groupId),
            eq(groupTeams.teamId, loserId!)
          ));
        
        if (loserTeam.length > 0) {
          await db.update(groupTeams)
            .set({
              played: (loserTeam[0].played || 0) + 1,
              lost: (loserTeam[0].lost || 0) + 1,
            })
            .where(eq(groupTeams.id, loserTeam[0].id));
        }
      }
    }

    return NextResponse.json({ success: true, message: 'Match updated' });
  } catch (error) {
    console.error('Error updating match:', error);
    return NextResponse.json({ error: 'Failed to update match' }, { status: 500 });
  }
}

// DELETE - Delete tournament
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.discordId || !ADMIN_IDS.includes(session.user.discordId)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const tournamentId = searchParams.get('tournamentId');

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 });
    }

    const id = parseInt(tournamentId);

    // Delete in order: matches -> groupTeams -> groups -> tournament
    await db.delete(matches).where(eq(matches.tournamentId, id));
    
    const groups = await db.select().from(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
    for (const group of groups) {
      await db.delete(groupTeams).where(eq(groupTeams.groupId, group.id));
    }
    
    await db.delete(tournamentGroups).where(eq(tournamentGroups.tournamentId, id));
    await db.delete(tournaments).where(eq(tournaments.id, id));

    return NextResponse.json({ success: true, message: 'Tournament deleted' });
  } catch (error) {
    console.error('Error deleting tournament:', error);
    return NextResponse.json({ error: 'Failed to delete tournament' }, { status: 500 });
  }
}
