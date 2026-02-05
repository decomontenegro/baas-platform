/**
 * Email Templates for Notifications
 */

import { NotificationType, NOTIFICATION_TYPE_META } from '@/types/notification'

export interface EmailTemplateData {
  type: NotificationType
  title: string
  body?: string | null
  data?: Record<string, unknown> | null
  userName?: string
}

/**
 * Render notification email HTML
 */
export function renderNotificationEmail(data: EmailTemplateData): string {
  const { type, title, body, userName } = data
  const meta = NOTIFICATION_TYPE_META[type]
  
  const greeting = userName ? `Hi ${userName},` : 'Hi,'
  const colorMap: Record<string, string> = {
    blue: '#3b82f6',
    orange: '#f97316',
    red: '#ef4444',
    yellow: '#eab308',
    green: '#22c55e',
    purple: '#a855f7',
    gray: '#6b7280',
  }
  const accentColor = colorMap[meta.color] || '#8b5cf6'

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${accentColor}, #d946ef); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                BaaS Dashboard
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 16px; color: #52525b; font-size: 16px;">
                ${greeting}
              </p>
              
              <div style="background-color: #f4f4f5; border-left: 4px solid ${accentColor}; padding: 16px 20px; margin: 24px 0; border-radius: 0 8px 8px 0;">
                <h2 style="margin: 0 0 8px; color: #18181b; font-size: 18px; font-weight: 600;">
                  ${title}
                </h2>
                ${body ? `<p style="margin: 0; color: #52525b; font-size: 14px; line-height: 1.5;">${body}</p>` : ''}
              </div>
              
              <p style="margin: 24px 0 0; color: #71717a; font-size: 14px;">
                This is an automated notification from your BaaS Dashboard.
              </p>
              
              <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard" 
                 style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: linear-gradient(135deg, ${accentColor}, #d946ef); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                View Dashboard
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f4f4f5; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0 0 8px; color: #71717a; font-size: 12px; text-align: center;">
                You're receiving this because you have notifications enabled for "${meta.label}".
              </p>
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings/notifications" 
                   style="color: #71717a; text-decoration: underline;">
                  Manage notification preferences
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * Render daily summary email
 */
export function renderDailySummaryEmail(data: {
  userName?: string
  stats: {
    totalConversations: number
    newConversations: number
    messagesHandled: number
    handoffsCompleted: number
    averageResponseTime: string
  }
  highlights?: string[]
}): string {
  const { userName, stats, highlights } = data
  const greeting = userName ? `Hi ${userName},` : 'Hi,'

  const highlightsList = highlights && highlights.length > 0
    ? highlights.map(h => `<li style="margin: 8px 0; color: #52525b;">${h}</li>`).join('')
    : ''

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary - BaaS Dashboard</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #8b5cf6, #d946ef); padding: 32px 40px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">
                📊 Daily Summary
              </h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">
                ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 24px; color: #52525b; font-size: 16px;">
                ${greeting} Here's your daily activity summary:
              </p>
              
              <!-- Stats Grid -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center; width: 50%;">
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #8b5cf6;">${stats.totalConversations}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase;">Total Conversations</p>
                  </td>
                  <td style="width: 16px;"></td>
                  <td style="padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center; width: 50%;">
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #22c55e;">${stats.newConversations}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase;">New Today</p>
                  </td>
                </tr>
                <tr><td colspan="3" style="height: 16px;"></td></tr>
                <tr>
                  <td style="padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center; width: 50%;">
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #3b82f6;">${stats.messagesHandled}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase;">Messages Handled</p>
                  </td>
                  <td style="width: 16px;"></td>
                  <td style="padding: 16px; background-color: #f4f4f5; border-radius: 8px; text-align: center; width: 50%;">
                    <p style="margin: 0; font-size: 28px; font-weight: 700; color: #f97316;">${stats.handoffsCompleted}</p>
                    <p style="margin: 4px 0 0; font-size: 12px; color: #71717a; text-transform: uppercase;">Handoffs</p>
                  </td>
                </tr>
              </table>
              
              <p style="margin: 24px 0 0; padding: 16px; background-color: #f0fdf4; border-radius: 8px; color: #166534; font-size: 14px; text-align: center;">
                ⚡ Average Response Time: <strong>${stats.averageResponseTime}</strong>
              </p>
              
              ${highlightsList ? `
              <div style="margin-top: 24px;">
                <h3 style="margin: 0 0 12px; color: #18181b; font-size: 16px; font-weight: 600;">Highlights</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  ${highlightsList}
                </ul>
              </div>
              ` : ''}
              
              <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/dashboard/analytics" 
                 style="display: inline-block; margin-top: 24px; padding: 12px 24px; background: linear-gradient(135deg, #8b5cf6, #d946ef); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
                View Full Analytics
              </a>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 40px; background-color: #f4f4f5; border-top: 1px solid #e4e4e7;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; text-align: center;">
                <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings/notifications" 
                   style="color: #71717a; text-decoration: underline;">
                  Manage notification preferences
                </a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}
