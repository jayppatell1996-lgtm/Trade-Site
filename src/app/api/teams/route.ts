import { NextResponse } from 'next/server';
import { getAllTeams } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const teams = await getAllTeams();
    return NextResponse.json(teams);
  } catch (error) {
    console.error('Error fetching teams:', error);
    return NextResponse.json({ error: 'Failed to fetch teams' }, { status: 500 });
  }
}
