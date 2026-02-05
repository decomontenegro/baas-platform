/**
 * Notification Templates System
 * Customizable templates with variable substitution for all notification types
 */

// ============================================================================
// Types
// ============================================================================

export interface TemplateVariables {
  // Bot/System info
  botName?: string;
  botId?: string;
  environment?: string;
  
  // Alert info
  alertType?: 'critical' | 'warning' | 'info';
  title?: string;
  message?: string;
  source?: string;
  timestamp?: string;
  
  // Metrics
  totalRequests?: number | string;
  errorRate?: number | string;
  avgResponseTime?: number | string;
  activeUsers?: number | string;
  uptime?: string;
  
  // Alert counts
  criticalCount?: number | string;
  warningCount?: number | string;
  infoCount?: number | string;
  
  // Period info
  date?: string;
  startDate?: string;
  endDate?: string;
  period?: string;
  
  // Lists (will be joined with newlines)
  highlights?: string[];
  issues?: string[];
  recommendations?: string[];
  
  // Custom
  [key: string]: unknown;
}

export interface Template {
  id: string;
  name: string;
  description: string;
  subject?: string;
  text: string;
  html?: string;
}

export type TemplateType = 
  | 'critical_alert'
  | 'warning_alert'
  | 'daily_report'
  | 'weekly_summary';

// ============================================================================
// Template Engine
// ============================================================================

/**
 * Substitutes variables in a template string
 * Supports: {{variable}}, {{variable|default}}, {{#list}}...{{/list}}
 */
export function renderTemplate(template: string, variables: TemplateVariables): string {
  let result = template;
  
  // Handle list blocks: {{#listName}}item template{{/listName}}
  result = result.replace(
    /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, listName, itemTemplate) => {
      const list = variables[listName];
      if (!Array.isArray(list) || list.length === 0) {
        return '';
      }
      return list.map((item, index) => {
        let rendered = itemTemplate;
        rendered = rendered.replace(/\{\{item\}\}/g, String(item));
        rendered = rendered.replace(/\{\{index\}\}/g, String(index + 1));
        return rendered;
      }).join('');
    }
  );
  
  // Handle conditionals: {{?variable}}content{{/variable}}
  result = result.replace(
    /\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
    (_, varName, content) => {
      const value = variables[varName];
      if (value && (Array.isArray(value) ? value.length > 0 : true)) {
        return content;
      }
      return '';
    }
  );
  
  // Handle variables with defaults: {{variable|default}}
  result = result.replace(
    /\{\{(\w+)\|([^}]*)\}\}/g,
    (_, varName, defaultValue) => {
      const value = variables[varName];
      if (value === undefined || value === null || value === '') {
        return defaultValue;
      }
      return Array.isArray(value) ? value.join('\n') : String(value);
    }
  );
  
  // Handle simple variables: {{variable}}
  result = result.replace(
    /\{\{(\w+)\}\}/g,
    (_, varName) => {
      const value = variables[varName];
      if (value === undefined || value === null) {
        return '';
      }
      return Array.isArray(value) ? value.join('\n') : String(value);
    }
  );
  
  return result;
}

/**
 * Renders a full template object with all its fields
 */
export function renderFullTemplate(template: Template, variables: TemplateVariables): Template {
  return {
    ...template,
    subject: template.subject ? renderTemplate(template.subject, variables) : undefined,
    text: renderTemplate(template.text, variables),
    html: template.html ? renderTemplate(template.html, variables) : undefined,
  };
}

// ============================================================================
// Default Templates - Text
// ============================================================================

export const TEXT_TEMPLATES: Record<TemplateType, Template> = {
  critical_alert: {
    id: 'critical_alert',
    name: 'Critical Alert',
    description: 'Template for critical system alerts requiring immediate attention',
    subject: '🚨 CRITICAL: {{title}} - {{botName|System}}',
    text: `🚨 *ALERTA CRÍTICO*

*Bot:* {{botName|Sistema}}
*Título:* {{title}}
*Horário:* {{timestamp}}
{{?source}}*Origem:* {{source}}{{/source}}

*Mensagem:*
{{message}}

⚠️ Este alerta requer atenção imediata!`,
  },

  warning_alert: {
    id: 'warning_alert',
    name: 'Warning Alert',
    description: 'Template for warning alerts that need attention',
    subject: '⚠️ WARNING: {{title}} - {{botName|System}}',
    text: `⚠️ *ALERTA DE AVISO*

*Bot:* {{botName|Sistema}}
*Título:* {{title}}
*Horário:* {{timestamp}}
{{?source}}*Origem:* {{source}}{{/source}}

*Mensagem:*
{{message}}

📋 Recomenda-se verificar quando possível.`,
  },

  daily_report: {
    id: 'daily_report',
    name: 'Daily Report',
    description: 'Template for daily summary reports',
    subject: '📊 Daily Report: {{botName|System}} - {{date}}',
    text: `📊 *RELATÓRIO DIÁRIO*

*Bot:* {{botName|Sistema}}
*Data:* {{date}}
*Ambiente:* {{environment|production}}

━━━━━━━━━━━━━━━━━━━━━━

📈 *MÉTRICAS*
• Total de requisições: {{totalRequests|0}}
• Taxa de erros: {{errorRate|0}}%
• Tempo médio de resposta: {{avgResponseTime|0}}ms
• Usuários ativos: {{activeUsers|0}}
• Uptime: {{uptime|N/A}}

━━━━━━━━━━━━━━━━━━━━━━

🚨 *ALERTAS DO DIA*
• Críticos: {{criticalCount|0}}
• Avisos: {{warningCount|0}}
• Informativos: {{infoCount|0}}

{{?highlights}}━━━━━━━━━━━━━━━━━━━━━━

✨ *DESTAQUES*
{{#highlights}}• {{item}}
{{/highlights}}{{/highlights}}
{{?issues}}━━━━━━━━━━━━━━━━━━━━━━

⚠️ *PROBLEMAS IDENTIFICADOS*
{{#issues}}• {{item}}
{{/issues}}{{/issues}}
{{?recommendations}}━━━━━━━━━━━━━━━━━━━━━━

💡 *RECOMENDAÇÕES*
{{#recommendations}}• {{item}}
{{/recommendations}}{{/recommendations}}`,
  },

  weekly_summary: {
    id: 'weekly_summary',
    name: 'Weekly Summary',
    description: 'Template for weekly summary reports',
    subject: '📅 Weekly Summary: {{botName|System}} - {{startDate}} to {{endDate}}',
    text: `📅 *RESUMO SEMANAL*

*Bot:* {{botName|Sistema}}
*Período:* {{startDate}} a {{endDate}}
*Ambiente:* {{environment|production}}

━━━━━━━━━━━━━━━━━━━━━━

📈 *MÉTRICAS DA SEMANA*
• Total de requisições: {{totalRequests|0}}
• Taxa média de erros: {{errorRate|0}}%
• Tempo médio de resposta: {{avgResponseTime|0}}ms
• Usuários ativos: {{activeUsers|0}}
• Uptime médio: {{uptime|N/A}}

━━━━━━━━━━━━━━━━━━━━━━

🚨 *TOTAL DE ALERTAS*
• Críticos: {{criticalCount|0}}
• Avisos: {{warningCount|0}}
• Informativos: {{infoCount|0}}

{{?highlights}}━━━━━━━━━━━━━━━━━━━━━━

✨ *PRINCIPAIS CONQUISTAS*
{{#highlights}}• {{item}}
{{/highlights}}{{/highlights}}
{{?issues}}━━━━━━━━━━━━━━━━━━━━━━

⚠️ *PROBLEMAS RECORRENTES*
{{#issues}}• {{item}}
{{/issues}}{{/issues}}
{{?recommendations}}━━━━━━━━━━━━━━━━━━━━━━

💡 *RECOMENDAÇÕES PARA PRÓXIMA SEMANA*
{{#recommendations}}• {{item}}
{{/recommendations}}{{/recommendations}}

━━━━━━━━━━━━━━━━━━━━━━
Relatório gerado automaticamente pelo Admin Agent`,
  },
};

// ============================================================================
// Default Templates - HTML
// ============================================================================

const HTML_STYLES = `
<style>
  body { 
    margin: 0; 
    padding: 0; 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
    background-color: #f3f4f6; 
  }
  .container { 
    max-width: 600px; 
    margin: 0 auto; 
    padding: 20px; 
  }
  .header { 
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%); 
    border-radius: 12px 12px 0 0; 
    padding: 24px; 
    color: white; 
  }
  .content { 
    background: white; 
    padding: 24px; 
    border-radius: 0 0 12px 12px; 
  }
  .metric-box { 
    background: #f8fafc; 
    border-radius: 8px; 
    padding: 16px; 
    margin: 8px 0; 
  }
  .metric-value { 
    font-size: 24px; 
    font-weight: bold; 
    color: #1e293b; 
  }
  .metric-label { 
    font-size: 12px; 
    color: #64748b; 
  }
  .alert-critical { 
    border-left: 4px solid #dc2626; 
    background: #fee2e2; 
  }
  .alert-warning { 
    border-left: 4px solid #d97706; 
    background: #fef3c7; 
  }
  .alert-info { 
    border-left: 4px solid #2563eb; 
    background: #dbeafe; 
  }
  .badge {
    display: inline-block;
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
  }
  .badge-critical { background: #dc2626; color: white; }
  .badge-warning { background: #d97706; color: white; }
  .badge-info { background: #2563eb; color: white; }
  ul { margin: 8px 0; padding-left: 20px; }
  li { margin: 4px 0; color: #374151; }
</style>
`;

export const HTML_TEMPLATES: Record<TemplateType, Template> = {
  critical_alert: {
    ...TEXT_TEMPLATES.critical_alert,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Critical Alert</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">🚨 Admin Agent Alert</h1>
    </div>
    <div class="content alert-critical" style="padding: 24px;">
      <span class="badge badge-critical">CRITICAL</span>
      <h2 style="margin: 16px 0 8px 0; color: #991b1b;">{{title}}</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">
        <strong>Bot:</strong> {{botName|Sistema}} | <strong>Time:</strong> {{timestamp}}
        {{?source}} | <strong>Source:</strong> {{source}}{{/source}}
      </p>
      <div style="background: white; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0; color: #374151;">{{message}}</p>
      </div>
      <p style="margin: 16px 0 0 0; color: #991b1b; font-weight: 600;">
        ⚠️ This alert requires immediate attention!
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  warning_alert: {
    ...TEXT_TEMPLATES.warning_alert,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Warning Alert</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">⚠️ Admin Agent Alert</h1>
    </div>
    <div class="content alert-warning" style="padding: 24px;">
      <span class="badge badge-warning">WARNING</span>
      <h2 style="margin: 16px 0 8px 0; color: #92400e;">{{title}}</h2>
      <p style="color: #64748b; font-size: 14px; margin: 0 0 16px 0;">
        <strong>Bot:</strong> {{botName|Sistema}} | <strong>Time:</strong> {{timestamp}}
        {{?source}} | <strong>Source:</strong> {{source}}{{/source}}
      </p>
      <div style="background: white; border-radius: 8px; padding: 16px; margin-top: 16px;">
        <p style="margin: 0; color: #374151;">{{message}}</p>
      </div>
      <p style="margin: 16px 0 0 0; color: #92400e;">
        📋 Recommended to check when possible.
      </p>
    </div>
  </div>
</body>
</html>`,
  },

  daily_report: {
    ...TEXT_TEMPLATES.daily_report,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Report</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">📊 Daily Report</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.8;">{{botName|Sistema}} - {{date}}</p>
    </div>
    <div class="content">
      <!-- Metrics Grid -->
      <h3 style="margin: 0 0 16px 0; color: #1e293b;">📈 Metrics</h3>
      <table width="100%" cellpadding="0" cellspacing="8">
        <tr>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{totalRequests|0}}</div>
              <div class="metric-label">Total Requests</div>
            </div>
          </td>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{errorRate|0}}%</div>
              <div class="metric-label">Error Rate</div>
            </div>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{avgResponseTime|0}}ms</div>
              <div class="metric-label">Avg Response Time</div>
            </div>
          </td>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{activeUsers|0}}</div>
              <div class="metric-label">Active Users</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Alerts Summary -->
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">🚨 Alerts Today</h3>
      <div style="display: flex; gap: 8px;">
        <span class="badge badge-critical">{{criticalCount|0}} Critical</span>
        <span class="badge badge-warning">{{warningCount|0}} Warning</span>
        <span class="badge badge-info">{{infoCount|0}} Info</span>
      </div>

      {{?highlights}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">✨ Highlights</h3>
      <ul>
        {{#highlights}}<li>{{item}}</li>{{/highlights}}
      </ul>
      {{/highlights}}

      {{?issues}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">⚠️ Issues</h3>
      <ul>
        {{#issues}}<li>{{item}}</li>{{/issues}}
      </ul>
      {{/issues}}

      {{?recommendations}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">💡 Recommendations</h3>
      <ul>
        {{#recommendations}}<li>{{item}}</li>{{/recommendations}}
      </ul>
      {{/recommendations}}
    </div>
  </div>
</body>
</html>`,
  },

  weekly_summary: {
    ...TEXT_TEMPLATES.weekly_summary,
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Weekly Summary</title>
  ${HTML_STYLES}
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; font-size: 20px;">📅 Weekly Summary</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.8;">{{botName|Sistema}} | {{startDate}} - {{endDate}}</p>
    </div>
    <div class="content">
      <!-- Metrics Grid -->
      <h3 style="margin: 0 0 16px 0; color: #1e293b;">📈 Weekly Metrics</h3>
      <table width="100%" cellpadding="0" cellspacing="8">
        <tr>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{totalRequests|0}}</div>
              <div class="metric-label">Total Requests</div>
            </div>
          </td>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{errorRate|0}}%</div>
              <div class="metric-label">Avg Error Rate</div>
            </div>
          </td>
        </tr>
        <tr>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{avgResponseTime|0}}ms</div>
              <div class="metric-label">Avg Response Time</div>
            </div>
          </td>
          <td width="50%">
            <div class="metric-box">
              <div class="metric-value">{{uptime|N/A}}</div>
              <div class="metric-label">Avg Uptime</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- Alerts Summary -->
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">🚨 Total Alerts</h3>
      <div style="display: flex; gap: 8px;">
        <span class="badge badge-critical">{{criticalCount|0}} Critical</span>
        <span class="badge badge-warning">{{warningCount|0}} Warning</span>
        <span class="badge badge-info">{{infoCount|0}} Info</span>
      </div>

      {{?highlights}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">✨ Key Achievements</h3>
      <ul>
        {{#highlights}}<li>{{item}}</li>{{/highlights}}
      </ul>
      {{/highlights}}

      {{?issues}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">⚠️ Recurring Issues</h3>
      <ul>
        {{#issues}}<li>{{item}}</li>{{/issues}}
      </ul>
      {{/issues}}

      {{?recommendations}}
      <h3 style="margin: 24px 0 16px 0; color: #1e293b;">💡 Recommendations for Next Week</h3>
      <ul>
        {{#recommendations}}<li>{{item}}</li>{{/recommendations}}
      </ul>
      {{/recommendations}}

      <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; text-align: center;">
        Report automatically generated by Admin Agent
      </p>
    </div>
  </div>
</body>
</html>`,
  },
};

// ============================================================================
// Template Registry & Helpers
// ============================================================================

/**
 * Get a template by type with HTML support
 */
export function getTemplate(type: TemplateType, preferHtml = false): Template {
  return preferHtml ? HTML_TEMPLATES[type] : TEXT_TEMPLATES[type];
}

/**
 * Get all available template types
 */
export function getTemplateTypes(): TemplateType[] {
  return Object.keys(TEXT_TEMPLATES) as TemplateType[];
}

/**
 * Render a notification from a template type and variables
 */
export function renderNotification(
  type: TemplateType,
  variables: TemplateVariables,
  options: { preferHtml?: boolean } = {}
): { subject?: string; text: string; html?: string } {
  const template = getTemplate(type, options.preferHtml);
  const rendered = renderFullTemplate(template, variables);
  
  return {
    subject: rendered.subject,
    text: rendered.text,
    html: options.preferHtml ? rendered.html : undefined,
  };
}

/**
 * Helper to format date for templates
 */
export function formatDate(date: Date, locale = 'pt-BR'): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Helper to format timestamp for templates
 */
export function formatTimestamp(date: Date, locale = 'pt-BR'): string {
  return date.toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ============================================================================
// Exports
// ============================================================================

export default {
  renderTemplate,
  renderFullTemplate,
  renderNotification,
  getTemplate,
  getTemplateTypes,
  formatDate,
  formatTimestamp,
  TEXT_TEMPLATES,
  HTML_TEMPLATES,
};
