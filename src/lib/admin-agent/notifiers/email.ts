/**
 * Email Notifier for Admin Agent
 * Uses Resend SDK for sending notification emails
 */

import { Resend } from 'resend';

// ============================================================================
// Types
// ============================================================================

export interface Alert {
  type: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  source?: string;
  timestamp?: Date;
  metadata?: Record<string, unknown>;
}

export interface DailySummary {
  date: Date;
  metrics: {
    totalRequests: number;
    errorRate: number;
    avgResponseTime: number;
    activeUsers: number;
  };
  alerts: {
    critical: number;
    warning: number;
    info: number;
  };
  highlights?: string[];
  issues?: string[];
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

// ============================================================================
// Configuration
// ============================================================================

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Admin Agent <admin@resend.dev>';
const RESEND_API_KEY = process.env.RESEND_API_KEY;

function getResendClient(): Resend {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set');
  }
  return new Resend(RESEND_API_KEY);
}

export function hasResendApiKey(): boolean {
  return !!RESEND_API_KEY;
}

// ============================================================================
// HTML Templates
// ============================================================================

function getAlertTemplate(alert: Alert): string {
  const colorMap = {
    critical: { bg: '#fee2e2', border: '#dc2626', text: '#991b1b', badge: '#dc2626' },
    warning: { bg: '#fef3c7', border: '#d97706', text: '#92400e', badge: '#d97706' },
    info: { bg: '#dbeafe', border: '#2563eb', text: '#1e40af', badge: '#2563eb' },
  };
  
  const colors = colorMap[alert.type];
  const timestamp = alert.timestamp || new Date();
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alert: ${alert.title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">
                🤖 Admin Agent Alert
              </h1>
            </td>
          </tr>
        </table>

        <!-- Alert Box -->
        <table width="100%" style="background: white; padding: 24px; border-left: 4px solid ${colors.border};">
          <tr>
            <td>
              <!-- Badge -->
              <span style="display: inline-block; background: ${colors.badge}; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px;">
                ${alert.type}
              </span>
              
              <!-- Title -->
              <h2 style="margin: 16px 0 12px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                ${alert.title}
              </h2>
              
              <!-- Message -->
              <p style="margin: 0 0 16px 0; color: #4b5563; font-size: 15px; line-height: 1.6;">
                ${alert.message}
              </p>
              
              <!-- Metadata -->
              <table style="background: ${colors.bg}; border-radius: 8px; padding: 16px; width: 100%;">
                <tr>
                  <td style="color: ${colors.text}; font-size: 13px;">
                    <strong>Source:</strong> ${alert.source || 'System'}<br>
                    <strong>Time:</strong> ${timestamp.toISOString()}
                    ${alert.metadata ? `<br><strong>Details:</strong> ${JSON.stringify(alert.metadata)}` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Footer -->
        <table width="100%" style="background: #f9fafb; border-radius: 0 0 12px 12px; padding: 16px;">
          <tr>
            <td style="text-align: center; color: #6b7280; font-size: 12px;">
              Sent by Admin Agent • BaaS Platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function getDailyReportTemplate(summary: DailySummary): string {
  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const alertTotal = summary.alerts.critical + summary.alerts.warning + summary.alerts.info;
  const healthScore = Math.max(0, 100 - (summary.alerts.critical * 20) - (summary.alerts.warning * 5) - (summary.metrics.errorRate * 10));
  const healthColor = healthScore >= 80 ? '#22c55e' : healthScore >= 50 ? '#eab308' : '#ef4444';
  
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report - ${formatDate(summary.date)}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <tr>
      <td>
        <!-- Header -->
        <table width="100%" style="background: linear-gradient(135deg, #1e293b 0%, #334155 100%); border-radius: 12px 12px 0 0; padding: 24px;">
          <tr>
            <td>
              <h1 style="margin: 0; color: white; font-size: 20px; font-weight: 600;">
                📊 Daily Report
              </h1>
              <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">
                ${formatDate(summary.date)}
              </p>
            </td>
            <td style="text-align: right;">
              <div style="background: ${healthColor}; color: white; padding: 12px 16px; border-radius: 8px; display: inline-block;">
                <div style="font-size: 24px; font-weight: bold;">${Math.round(healthScore)}%</div>
                <div style="font-size: 11px; opacity: 0.9;">Health Score</div>
              </div>
            </td>
          </tr>
        </table>

        <!-- Metrics Grid -->
        <table width="100%" style="background: white; padding: 24px;">
          <tr>
            <td colspan="2" style="padding-bottom: 16px;">
              <h3 style="margin: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                Key Metrics
              </h3>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding: 8px;">
              <table style="background: #f0f9ff; border-radius: 8px; padding: 16px; width: 100%;">
                <tr>
                  <td>
                    <div style="color: #0369a1; font-size: 24px; font-weight: bold;">${summary.metrics.totalRequests.toLocaleString()}</div>
                    <div style="color: #0369a1; font-size: 12px; opacity: 0.8;">Total Requests</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" style="padding: 8px;">
              <table style="background: ${summary.metrics.errorRate > 5 ? '#fef2f2' : '#f0fdf4'}; border-radius: 8px; padding: 16px; width: 100%;">
                <tr>
                  <td>
                    <div style="color: ${summary.metrics.errorRate > 5 ? '#dc2626' : '#16a34a'}; font-size: 24px; font-weight: bold;">${summary.metrics.errorRate.toFixed(2)}%</div>
                    <div style="color: ${summary.metrics.errorRate > 5 ? '#dc2626' : '#16a34a'}; font-size: 12px; opacity: 0.8;">Error Rate</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding: 8px;">
              <table style="background: #faf5ff; border-radius: 8px; padding: 16px; width: 100%;">
                <tr>
                  <td>
                    <div style="color: #7c3aed; font-size: 24px; font-weight: bold;">${summary.metrics.avgResponseTime}ms</div>
                    <div style="color: #7c3aed; font-size: 12px; opacity: 0.8;">Avg Response Time</div>
                  </td>
                </tr>
              </table>
            </td>
            <td width="50%" style="padding: 8px;">
              <table style="background: #fffbeb; border-radius: 8px; padding: 16px; width: 100%;">
                <tr>
                  <td>
                    <div style="color: #d97706; font-size: 24px; font-weight: bold;">${summary.metrics.activeUsers.toLocaleString()}</div>
                    <div style="color: #d97706; font-size: 12px; opacity: 0.8;">Active Users</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Alerts Summary -->
        <table width="100%" style="background: white; padding: 0 24px 24px 24px;">
          <tr>
            <td style="padding-bottom: 16px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <h3 style="margin: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                Alerts Summary (${alertTotal} total)
              </h3>
            </td>
          </tr>
          <tr>
            <td>
              <table width="100%" style="border-collapse: collapse;">
                <tr>
                  <td style="padding: 12px; background: #fef2f2; border-radius: 8px 0 0 8px; text-align: center;">
                    <div style="color: #dc2626; font-size: 20px; font-weight: bold;">${summary.alerts.critical}</div>
                    <div style="color: #dc2626; font-size: 11px;">Critical</div>
                  </td>
                  <td style="padding: 12px; background: #fffbeb; text-align: center;">
                    <div style="color: #d97706; font-size: 20px; font-weight: bold;">${summary.alerts.warning}</div>
                    <div style="color: #d97706; font-size: 11px;">Warning</div>
                  </td>
                  <td style="padding: 12px; background: #eff6ff; border-radius: 0 8px 8px 0; text-align: center;">
                    <div style="color: #2563eb; font-size: 20px; font-weight: bold;">${summary.alerts.info}</div>
                    <div style="color: #2563eb; font-size: 11px;">Info</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        ${summary.highlights && summary.highlights.length > 0 ? `
        <!-- Highlights -->
        <table width="100%" style="background: white; padding: 0 24px 24px 24px;">
          <tr>
            <td style="padding-bottom: 12px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <h3 style="margin: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ✨ Highlights
              </h3>
            </td>
          </tr>
          <tr>
            <td>
              <ul style="margin: 0; padding-left: 20px; color: #4b5563; font-size: 14px; line-height: 1.8;">
                ${summary.highlights.map(h => `<li>${h}</li>`).join('')}
              </ul>
            </td>
          </tr>
        </table>
        ` : ''}

        ${summary.issues && summary.issues.length > 0 ? `
        <!-- Issues -->
        <table width="100%" style="background: white; padding: 0 24px 24px 24px;">
          <tr>
            <td style="padding-bottom: 12px; border-top: 1px solid #e5e7eb; padding-top: 24px;">
              <h3 style="margin: 0; color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">
                ⚠️ Issues to Address
              </h3>
            </td>
          </tr>
          <tr>
            <td>
              <ul style="margin: 0; padding-left: 20px; color: #dc2626; font-size: 14px; line-height: 1.8;">
                ${summary.issues.map(i => `<li>${i}</li>`).join('')}
              </ul>
            </td>
          </tr>
        </table>
        ` : ''}

        <!-- Footer -->
        <table width="100%" style="background: #f9fafb; border-radius: 0 0 12px 12px; padding: 16px;">
          <tr>
            <td style="text-align: center; color: #6b7280; font-size: 12px;">
              Generated by Admin Agent • BaaS Platform
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ============================================================================
// Email Functions
// ============================================================================

/**
 * Sends an alert email notification
 * @param to - Recipient email address or array of addresses
 * @param alert - Alert details
 * @returns EmailResult with success status and message ID or error
 */
export async function sendAlertEmail(
  to: string | string[],
  alert: Alert
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    
    const subjectPrefix = {
      critical: '🚨 CRITICAL',
      warning: '⚠️ WARNING',
      info: 'ℹ️ INFO',
    };

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `${subjectPrefix[alert.type]}: ${alert.title}`,
      html: getAlertTemplate(alert),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending alert email';
    return { success: false, error: message };
  }
}

/**
 * Sends a daily summary report email
 * @param to - Recipient email address or array of addresses
 * @param summary - Daily summary data
 * @returns EmailResult with success status and message ID or error
 */
export async function sendDailyReport(
  to: string | string[],
  summary: DailySummary
): Promise<EmailResult> {
  try {
    const resend = getResendClient();
    
    const dateStr = summary.date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject: `📊 Daily Report - ${dateStr}`,
      html: getDailyReportTemplate(summary),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error sending daily report';
    return { success: false, error: message };
  }
}
