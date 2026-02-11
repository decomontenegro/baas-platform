import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // TODO: Implement OAuth usage check
    // This would query OpenClaw/Clawdbot for OAuth account status
    
    // Mock data based on session_status info
    const oauthUsage = {
      accounts: [
        {
          id: 'primary',
          name: 'OAuth Primary',
          file: '.credentials.json',
          active: true,
          daily: {
            used: 20,
            total: 100,
            remaining: 80
          },
          weekly: {
            used: 45,
            total: 100,
            remaining: 55
          }
        },
        {
          id: 'backup', 
          name: 'OAuth Backup',
          file: '.credentials-primary.json',
          active: false,
          daily: {
            used: 15,
            total: 100,
            remaining: 85
          },
          weekly: {
            used: 30,
            total: 100,
            remaining: 70
          }
        }
      ],
      lastUpdated: new Date().toISOString(),
      autoSwitch: true
    };

    return NextResponse.json(oauthUsage);
  } catch (error) {
    console.error('Error fetching OAuth usage:', error);
    return NextResponse.json(
      { error: 'Failed to fetch OAuth usage' },
      { status: 500 }
    );
  }
}