# Mission Control - Daily Standup Automático

Especificação do sistema de Daily Standup automático para equipes de agentes AI.

## Overview

O Daily Standup é um relatório automatizado gerado diariamente que consolida o status de todas as tarefas e agentes no Mission Control, simulando uma reunião de standup tradicional.

```
┌─────────────────────────────────────────────────────────────┐
│                    DAILY STANDUP FLOW                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────────┐        │
│   │   Cron   │────►│ Collector │────►│   Renderer   │        │
│   │  09:00   │     │           │     │              │        │
│   └──────────┘     └──────────┘     └──────┬───────┘        │
│                                             │                │
│               ┌─────────────────────────────┤                │
│               │                             │                │
│               ▼                             ▼                │
│   ┌───────────────────┐         ┌─────────────────┐         │
│   │   Telegram/WA     │         │    Dashboard    │         │
│   │   Notification    │         │    + Storage    │         │
│   └───────────────────┘         └─────────────────┘         │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 1. Schema de Dados

### Novo Model: DailyStandup

```prisma
// Adicionar ao schema.prisma

model DailyStandup {
  id          String   @id @default(cuid())
  
  // Período coberto
  date        DateTime @db.Date  // Data do standup
  periodStart DateTime           // Início do período (geralmente 24h antes)
  periodEnd   DateTime           // Fim do período (hora do standup)
  
  // Conteúdo
  summary     String   @db.Text  // Resumo em linguagem natural
  metrics     Json               // Métricas agregadas (ver StandupMetrics)
  sections    Json               // Seções do relatório (ver StandupSections)
  
  // Entrega
  deliveredAt   DateTime?
  deliveryChannels Json?         // [{type: "whatsapp", target: "...", status: "sent"}]
  
  // Metadata
  generatedBy String?            // Agent que gerou (se aplicável)
  tenantId    String?            // Multi-tenant support
  
  createdAt   DateTime @default(now())
  
  @@unique([date, tenantId])
  @@index([date])
  @@index([tenantId])
}

// Tipos JSON auxiliares (TypeScript)
interface StandupMetrics {
  totalTasks: number;
  completed: number;
  inProgress: number;
  blocked: number;
  inReview: number;
  created: number;          // Novas no período
  completionRate: number;   // % completadas vs total ativas
  avgCycleTimeHours: number; // Tempo médio para completar
  activeAgents: number;
}

interface StandupSections {
  completed: TaskSummary[];
  inProgress: TaskSummary[];
  blocked: BlockedTask[];
  needsReview: TaskSummary[];
  highlights: string[];     // Eventos importantes
  concerns: string[];       // Problemas identificados
}

interface TaskSummary {
  id: string;
  title: string;
  assignees: string[];      // Nomes dos agentes
  priority: string;
  completedAt?: string;
  startedAt?: string;
}

interface BlockedTask {
  id: string;
  title: string;
  assignees: string[];
  blockedReason?: string;   // Extraído de comentários/atividades
  blockedSince: string;
  dependsOn?: string[];     // Tasks que está esperando
}
```

---

## 2. Cron Job

### Configuração

```typescript
// standup-cron.ts

interface StandupConfig {
  // Quando rodar
  schedule: string;          // Cron expression (ex: "0 9 * * 1-5")
  timezone: string;          // Ex: "America/Sao_Paulo"
  
  // Período de coleta
  lookbackHours: number;     // Quantas horas olhar para trás (default: 24)
  
  // Delivery
  channels: DeliveryChannel[];
  
  // Personalização
  includeMetrics: boolean;
  includeConcerns: boolean;
  language: 'pt-BR' | 'en-US';
}

interface DeliveryChannel {
  type: 'whatsapp' | 'telegram' | 'slack' | 'email' | 'webhook';
  target: string;           // Número, chat_id, channel, email, URL
  format: 'full' | 'summary';
  enabled: boolean;
}

// Exemplo de configuração
const defaultConfig: StandupConfig = {
  schedule: "0 9 * * 1-5",   // 09:00 de segunda a sexta
  timezone: "America/Sao_Paulo",
  lookbackHours: 24,
  channels: [
    {
      type: 'whatsapp',
      target: '5511999999999',
      format: 'full',
      enabled: true
    },
    {
      type: 'telegram',
      target: '@team_channel',
      format: 'summary',
      enabled: true
    }
  ],
  includeMetrics: true,
  includeConcerns: true,
  language: 'pt-BR'
};
```

### Implementação do Job

```typescript
// standup-job.ts

import { CronJob } from 'cron';
import { prisma } from './db';
import { generateStandup } from './standup-generator';
import { deliverStandup } from './standup-delivery';

export function initStandupCron(config: StandupConfig) {
  const job = new CronJob(
    config.schedule,
    async () => {
      console.log(`[Standup] Starting daily standup generation...`);
      
      try {
        // 1. Coleta dados
        const data = await collectStandupData(config.lookbackHours);
        
        // 2. Gera relatório
        const standup = await generateStandup(data, config);
        
        // 3. Salva no banco
        const saved = await prisma.dailyStandup.create({
          data: {
            date: new Date().toISOString().split('T')[0],
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            summary: standup.summary,
            metrics: standup.metrics,
            sections: standup.sections,
            tenantId: config.tenantId
          }
        });
        
        // 4. Entrega nos canais
        const deliveryResults = await deliverStandup(saved, config.channels);
        
        // 5. Atualiza status de entrega
        await prisma.dailyStandup.update({
          where: { id: saved.id },
          data: {
            deliveredAt: new Date(),
            deliveryChannels: deliveryResults
          }
        });
        
        console.log(`[Standup] Daily standup delivered successfully`);
        
      } catch (error) {
        console.error(`[Standup] Failed to generate standup:`, error);
        // TODO: Notificar admin
      }
    },
    null,
    true,
    config.timezone
  );
  
  return job;
}
```

---

## 3. Coleta de Dados

### Query de Tarefas

```typescript
// standup-collector.ts

interface CollectedData {
  periodStart: Date;
  periodEnd: Date;
  tasks: {
    completed: Task[];
    inProgress: Task[];
    blocked: Task[];
    inReview: Task[];
    created: Task[];
  };
  agents: Agent[];
  activities: Activity[];
  comments: TaskComment[];
}

async function collectStandupData(lookbackHours: number): Promise<CollectedData> {
  const periodEnd = new Date();
  const periodStart = new Date(periodEnd.getTime() - lookbackHours * 60 * 60 * 1000);
  
  // Tasks completadas no período
  const completed = await prisma.task.findMany({
    where: {
      status: 'DONE',
      completedAt: {
        gte: periodStart,
        lte: periodEnd
      }
    },
    include: {
      assignees: true
    },
    orderBy: { completedAt: 'desc' }
  });
  
  // Tasks em progresso
  const inProgress = await prisma.task.findMany({
    where: {
      status: 'IN_PROGRESS'
    },
    include: {
      assignees: true,
      currentAgent: true
    },
    orderBy: { priority: 'asc' }
  });
  
  // Tasks bloqueadas
  const blocked = await prisma.task.findMany({
    where: {
      status: 'BLOCKED'
    },
    include: {
      assignees: true,
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 1  // Último comentário (pode explicar o bloqueio)
      }
    }
  });
  
  // Tasks em review
  const inReview = await prisma.task.findMany({
    where: {
      status: 'IN_REVIEW'
    },
    include: {
      assignees: true
    }
  });
  
  // Tasks criadas no período
  const created = await prisma.task.findMany({
    where: {
      createdAt: {
        gte: periodStart,
        lte: periodEnd
      }
    }
  });
  
  // Agentes ativos no período
  const agents = await prisma.agent.findMany({
    where: {
      lastActiveAt: {
        gte: periodStart
      }
    }
  });
  
  // Atividades importantes
  const activities = await prisma.activity.findMany({
    where: {
      createdAt: {
        gte: periodStart,
        lte: periodEnd
      },
      type: {
        in: ['TASK_COMPLETED', 'TASK_BLOCKED', 'SYSTEM_ERROR', 'AGENT_STOPPED']
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  
  return {
    periodStart,
    periodEnd,
    tasks: { completed, inProgress, blocked, inReview, created },
    agents,
    activities,
    comments: []
  };
}
```

### Cálculo de Métricas

```typescript
function calculateMetrics(data: CollectedData): StandupMetrics {
  const { tasks, agents } = data;
  
  const totalActive = 
    tasks.inProgress.length + 
    tasks.blocked.length + 
    tasks.inReview.length;
  
  // Cycle time médio (tasks completadas)
  const cycleTimes = tasks.completed
    .filter(t => t.startedAt && t.completedAt)
    .map(t => {
      const start = new Date(t.startedAt!).getTime();
      const end = new Date(t.completedAt!).getTime();
      return (end - start) / (1000 * 60 * 60); // em horas
    });
  
  const avgCycleTime = cycleTimes.length > 0
    ? cycleTimes.reduce((a, b) => a + b, 0) / cycleTimes.length
    : 0;
  
  return {
    totalTasks: totalActive + tasks.completed.length,
    completed: tasks.completed.length,
    inProgress: tasks.inProgress.length,
    blocked: tasks.blocked.length,
    inReview: tasks.inReview.length,
    created: tasks.created.length,
    completionRate: totalActive > 0 
      ? Math.round((tasks.completed.length / (totalActive + tasks.completed.length)) * 100)
      : 0,
    avgCycleTimeHours: Math.round(avgCycleTime * 10) / 10,
    activeAgents: agents.length
  };
}
```

---

## 4. Formato do Relatório

### Template (Português)

```typescript
function renderStandup(data: CollectedData, metrics: StandupMetrics, config: StandupConfig): string {
  const date = new Date().toLocaleDateString('pt-BR', { 
    weekday: 'long', 
    day: 'numeric', 
    month: 'long' 
  });
  
  let report = `📊 *Daily Standup - ${date}*\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  
  // Métricas
  if (config.includeMetrics) {
    report += `📈 *Métricas*\n`;
    report += `• Total de tasks: ${metrics.totalTasks}\n`;
    report += `• Completadas (24h): ${metrics.completed}\n`;
    report += `• Em progresso: ${metrics.inProgress}\n`;
    report += `• Bloqueadas: ${metrics.blocked}\n`;
    report += `• Aguardando review: ${metrics.inReview}\n`;
    report += `• Taxa de conclusão: ${metrics.completionRate}%\n`;
    report += `• Agentes ativos: ${metrics.activeAgents}\n\n`;
  }
  
  // Completadas
  if (data.tasks.completed.length > 0) {
    report += `✅ *Completadas*\n`;
    for (const task of data.tasks.completed.slice(0, 10)) {
      const assignees = task.assignees.map(a => a.name).join(', ') || 'não atribuída';
      report += `• ${task.title} (${assignees})\n`;
    }
    if (data.tasks.completed.length > 10) {
      report += `  _...e mais ${data.tasks.completed.length - 10}_\n`;
    }
    report += '\n';
  }
  
  // Em progresso
  if (data.tasks.inProgress.length > 0) {
    report += `🔄 *Em Progresso*\n`;
    for (const task of data.tasks.inProgress.slice(0, 10)) {
      const assignees = task.assignees.map(a => a.name).join(', ') || 'não atribuída';
      const priority = getPriorityEmoji(task.priority);
      report += `• ${priority} ${task.title} (${assignees})\n`;
    }
    if (data.tasks.inProgress.length > 10) {
      report += `  _...e mais ${data.tasks.inProgress.length - 10}_\n`;
    }
    report += '\n';
  }
  
  // Bloqueadas (sempre mostrar - importante!)
  if (data.tasks.blocked.length > 0) {
    report += `🚫 *Bloqueadas* ⚠️\n`;
    for (const task of data.tasks.blocked) {
      const assignees = task.assignees.map(a => a.name).join(', ') || 'não atribuída';
      report += `• ${task.title} (${assignees})\n`;
      if (task.comments?.[0]) {
        report += `  _"${truncate(task.comments[0].content, 50)}"_\n`;
      }
    }
    report += '\n';
  }
  
  // Aguardando review
  if (data.tasks.inReview.length > 0) {
    report += `👀 *Aguardando Review*\n`;
    for (const task of data.tasks.inReview) {
      const assignees = task.assignees.map(a => a.name).join(', ') || 'não atribuída';
      report += `• ${task.title} (${assignees})\n`;
    }
    report += '\n';
  }
  
  // Preocupações
  if (config.includeConcerns && metrics.blocked > 0) {
    report += `⚠️ *Atenção*\n`;
    if (metrics.blocked > 0) {
      report += `• ${metrics.blocked} task(s) bloqueada(s) - requer ação\n`;
    }
    if (metrics.inReview > 3) {
      report += `• Fila de review crescendo (${metrics.inReview} tasks)\n`;
    }
    report += '\n';
  }
  
  // Footer
  report += `━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `🔗 _Ver detalhes: /dashboard/standup_`;
  
  return report;
}

function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case 'CRITICAL': return '🔴';
    case 'HIGH': return '🟠';
    case 'MEDIUM': return '🟡';
    case 'LOW': return '🟢';
    default: return '⚪';
  }
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
```

### Exemplo de Output

```
📊 *Daily Standup - terça-feira, 4 de fevereiro*
━━━━━━━━━━━━━━━━━━━━━━

📈 *Métricas*
• Total de tasks: 23
• Completadas (24h): 5
• Em progresso: 8
• Bloqueadas: 2
• Aguardando review: 3
• Taxa de conclusão: 22%
• Agentes ativos: 4

✅ *Completadas*
• Implementar autenticação OAuth (dev-agent-01)
• Corrigir bug de timezone (dev-agent-02)
• Documentar API de webhooks (docs-agent)
• Pesquisar concorrentes (researcher-01)
• Criar testes E2E login (test-agent)

🔄 *Em Progresso*
• 🔴 Integração com Stripe (dev-agent-01)
• 🟠 Dashboard de métricas (dev-agent-02)
• 🟡 Onboarding flow (dev-agent-03)
• 🟡 Refatorar módulo de notificações (dev-agent-01)

🚫 *Bloqueadas* ⚠️
• Setup ambiente staging (devops-agent)
  _"Aguardando credenciais AWS do cliente"_
• Integração com CRM legado (dev-agent-04)
  _"API do CRM fora do ar desde ontem"_

👀 *Aguardando Review*
• PR #142: Novo sistema de permissões (dev-agent-01)
• PR #145: Migração para PostgreSQL (dev-agent-02)
• Spec: Módulo de relatórios (architect-agent)

⚠️ *Atenção*
• 2 task(s) bloqueada(s) - requer ação
• Fila de review crescendo (3 tasks)

━━━━━━━━━━━━━━━━━━━━━━
🔗 _Ver detalhes: /dashboard/standup_
```

---

## 5. Sistema de Entrega

### Implementação Multi-Canal

```typescript
// standup-delivery.ts

import { DailyStandup } from '@prisma/client';

interface DeliveryResult {
  channel: string;
  target: string;
  status: 'sent' | 'failed';
  error?: string;
  sentAt?: string;
}

async function deliverStandup(
  standup: DailyStandup, 
  channels: DeliveryChannel[]
): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  
  for (const channel of channels.filter(c => c.enabled)) {
    try {
      const content = channel.format === 'summary'
        ? renderSummary(standup)
        : renderFull(standup);
      
      switch (channel.type) {
        case 'whatsapp':
          await sendWhatsApp(channel.target, content);
          break;
          
        case 'telegram':
          await sendTelegram(channel.target, content);
          break;
          
        case 'slack':
          await sendSlack(channel.target, content);
          break;
          
        case 'email':
          await sendEmail(channel.target, 'Daily Standup', content);
          break;
          
        case 'webhook':
          await sendWebhook(channel.target, standup);
          break;
      }
      
      results.push({
        channel: channel.type,
        target: channel.target,
        status: 'sent',
        sentAt: new Date().toISOString()
      });
      
    } catch (error) {
      results.push({
        channel: channel.type,
        target: channel.target,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  return results;
}

// WhatsApp via Clawdbot message tool
async function sendWhatsApp(target: string, content: string): Promise<void> {
  // Usa a API do Clawdbot
  await clawdbot.message.send({
    channel: 'whatsapp',
    target: target,
    message: content
  });
}

// Telegram via Bot API
async function sendTelegram(chatId: string, content: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: content,
      parse_mode: 'Markdown'
    })
  });
}

// Versão resumida para canais com limite de caracteres
function renderSummary(standup: DailyStandup): string {
  const metrics = standup.metrics as StandupMetrics;
  
  return `📊 Standup ${new Date(standup.date).toLocaleDateString('pt-BR')}

✅ ${metrics.completed} completadas
🔄 ${metrics.inProgress} em progresso
🚫 ${metrics.blocked} bloqueadas
👀 ${metrics.inReview} em review

Ver detalhes: /dashboard/standup`;
}
```

---

## 6. Dashboard Web

### Página de Histórico

**Rota:** `/dashboard/standup`

```tsx
// app/dashboard/standup/page.tsx

import { prisma } from '@/lib/db';
import { StandupCard } from './standup-card';
import { StandupMetricsChart } from './metrics-chart';

export default async function StandupHistoryPage() {
  const standups = await prisma.dailyStandup.findMany({
    orderBy: { date: 'desc' },
    take: 30
  });
  
  const metrics = standups.map(s => ({
    date: s.date,
    ...(s.metrics as StandupMetrics)
  }));
  
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">📊 Daily Standups</h1>
      
      {/* Gráfico de tendências */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Tendências (30 dias)</h2>
        <StandupMetricsChart data={metrics} />
      </section>
      
      {/* Lista de standups */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Histórico</h2>
        <div className="space-y-4">
          {standups.map(standup => (
            <StandupCard key={standup.id} standup={standup} />
          ))}
        </div>
      </section>
    </div>
  );
}
```

### Componente de Card

```tsx
// app/dashboard/standup/standup-card.tsx

'use client';

import { DailyStandup } from '@prisma/client';
import { useState } from 'react';

interface Props {
  standup: DailyStandup;
}

export function StandupCard({ standup }: Props) {
  const [expanded, setExpanded] = useState(false);
  const metrics = standup.metrics as StandupMetrics;
  const sections = standup.sections as StandupSections;
  
  return (
    <div className="border rounded-lg p-4 bg-white shadow-sm">
      {/* Header */}
      <div 
        className="flex justify-between items-center cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <h3 className="font-semibold">
            {new Date(standup.date).toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long'
            })}
          </h3>
          <p className="text-sm text-gray-500">
            {metrics.completed} completadas • {metrics.blocked} bloqueadas
          </p>
        </div>
        
        {/* Métricas rápidas */}
        <div className="flex gap-4 text-sm">
          <span className="text-green-600">✅ {metrics.completed}</span>
          <span className="text-blue-600">🔄 {metrics.inProgress}</span>
          <span className="text-red-600">🚫 {metrics.blocked}</span>
          <span className="text-yellow-600">👀 {metrics.inReview}</span>
        </div>
      </div>
      
      {/* Conteúdo expandido */}
      {expanded && (
        <div className="mt-4 pt-4 border-t">
          {/* Resumo */}
          <p className="text-gray-700 mb-4">{standup.summary}</p>
          
          {/* Seções */}
          <div className="grid grid-cols-2 gap-4">
            {sections.completed.length > 0 && (
              <TaskList title="Completadas" tasks={sections.completed} icon="✅" />
            )}
            {sections.inProgress.length > 0 && (
              <TaskList title="Em Progresso" tasks={sections.inProgress} icon="🔄" />
            )}
            {sections.blocked.length > 0 && (
              <TaskList title="Bloqueadas" tasks={sections.blocked} icon="🚫" />
            )}
            {sections.needsReview.length > 0 && (
              <TaskList title="Em Review" tasks={sections.needsReview} icon="👀" />
            )}
          </div>
          
          {/* Delivery status */}
          {standup.deliveryChannels && (
            <div className="mt-4 text-sm text-gray-500">
              Entregue em: {(standup.deliveryChannels as DeliveryResult[])
                .filter(d => d.status === 'sent')
                .map(d => d.channel)
                .join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### API Endpoints

```typescript
// app/api/standups/route.ts

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/standups - Lista standups
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '30');
  const offset = parseInt(searchParams.get('offset') || '0');
  
  const standups = await prisma.dailyStandup.findMany({
    orderBy: { date: 'desc' },
    take: limit,
    skip: offset
  });
  
  return NextResponse.json(standups);
}

// POST /api/standups/generate - Gera standup manualmente
export async function POST(request: Request) {
  const config = await request.json();
  
  // Gera standup sob demanda
  const data = await collectStandupData(config.lookbackHours || 24);
  const standup = await generateStandup(data, config);
  
  const saved = await prisma.dailyStandup.create({
    data: {
      date: new Date(),
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      summary: standup.summary,
      metrics: standup.metrics,
      sections: standup.sections
    }
  });
  
  // Opcionalmente entrega
  if (config.deliver) {
    await deliverStandup(saved, config.channels);
  }
  
  return NextResponse.json(saved);
}
```

---

## 7. Configuração por Tenant

### Model de Configuração

```prisma
model StandupConfig {
  id          String   @id @default(cuid())
  tenantId    String   @unique
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  // Schedule
  enabled     Boolean  @default(true)
  schedule    String   @default("0 9 * * 1-5")  // Cron
  timezone    String   @default("UTC")
  
  // Collection
  lookbackHours Int    @default(24)
  
  // Content
  includeMetrics  Boolean @default(true)
  includeConcerns Boolean @default(true)
  language        String  @default("pt-BR")
  
  // Delivery
  channels    Json     // DeliveryChannel[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### UI de Configuração

```tsx
// app/dashboard/settings/standup/page.tsx

export default function StandupSettingsPage() {
  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">⚙️ Configuração do Standup</h1>
      
      <form className="space-y-6">
        {/* Horário */}
        <section>
          <h2 className="font-semibold mb-2">Horário</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Hora</label>
              <input type="time" defaultValue="09:00" />
            </div>
            <div>
              <label>Dias</label>
              <select multiple>
                <option value="1">Segunda</option>
                <option value="2">Terça</option>
                <option value="3">Quarta</option>
                <option value="4">Quinta</option>
                <option value="5">Sexta</option>
                <option value="6">Sábado</option>
                <option value="0">Domingo</option>
              </select>
            </div>
          </div>
        </section>
        
        {/* Canais de entrega */}
        <section>
          <h2 className="font-semibold mb-2">Entregar em</h2>
          <div className="space-y-2">
            <ChannelToggle type="whatsapp" label="WhatsApp" />
            <ChannelToggle type="telegram" label="Telegram" />
            <ChannelToggle type="slack" label="Slack" />
            <ChannelToggle type="email" label="Email" />
          </div>
        </section>
        
        {/* Conteúdo */}
        <section>
          <h2 className="font-semibold mb-2">Conteúdo</h2>
          <div className="space-y-2">
            <Checkbox label="Incluir métricas" defaultChecked />
            <Checkbox label="Incluir alertas de problemas" defaultChecked />
            <Checkbox label="Incluir gráficos (email apenas)" />
          </div>
        </section>
        
        <button type="submit" className="btn-primary">
          Salvar Configurações
        </button>
      </form>
    </div>
  );
}
```

---

## 8. Integrações Futuras

### AI Summary

Usar LLM para gerar resumo em linguagem natural:

```typescript
async function generateAISummary(data: CollectedData): Promise<string> {
  const prompt = `
    Analise os dados do standup e gere um resumo executivo em 2-3 frases:
    
    - Tasks completadas: ${data.tasks.completed.length}
    - Em progresso: ${data.tasks.inProgress.length}
    - Bloqueadas: ${data.tasks.blocked.length} (${data.tasks.blocked.map(t => t.title).join(', ')})
    - Em review: ${data.tasks.inReview.length}
    
    Destaques do dia:
    ${data.activities.slice(0, 5).map(a => `- ${a.message}`).join('\n')}
    
    Gere um resumo focando nos pontos mais importantes e quaisquer problemas que precisam de atenção.
  `;
  
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return response.content[0].text;
}
```

### Slack Blocks (Rich Formatting)

```typescript
function renderSlackBlocks(standup: DailyStandup): SlackBlock[] {
  const metrics = standup.metrics as StandupMetrics;
  
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📊 Daily Standup - ${formatDate(standup.date)}`
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Completadas*\n${metrics.completed}` },
        { type: 'mrkdwn', text: `*Em Progresso*\n${metrics.inProgress}` },
        { type: 'mrkdwn', text: `*Bloqueadas*\n${metrics.blocked}` },
        { type: 'mrkdwn', text: `*Em Review*\n${metrics.inReview}` }
      ]
    },
    {
      type: 'divider'
    },
    // ... mais seções
  ];
}
```

---

## Checklist de Implementação

### Fase 1: Core
- [ ] Criar model `DailyStandup` no Prisma
- [ ] Implementar `collectStandupData()`
- [ ] Implementar `calculateMetrics()`
- [ ] Implementar `renderStandup()` (formato texto)

### Fase 2: Delivery
- [ ] Integração WhatsApp via Clawdbot
- [ ] Integração Telegram
- [ ] Job de cron configurável

### Fase 3: Dashboard
- [ ] Página de histórico `/dashboard/standup`
- [ ] Card expandível com detalhes
- [ ] Gráfico de tendências

### Fase 4: Configuração
- [ ] Model `StandupConfig`
- [ ] UI de configuração por tenant
- [ ] Múltiplos canais de delivery

### Fase 5: Melhorias
- [ ] AI summary via LLM
- [ ] Slack rich blocks
- [ ] Email com gráficos HTML
- [ ] Webhook para integrações custom

---

## Referências

- Mission Control Schema: `MISSION-CONTROL-SCHEMA.md`
- Admin Agent Architecture: `ADMIN-AGENT-ARCHITECTURE.md`
- Artigo original: "Building AI agent teams that actually work together" - Bhanu Teja P.

---

*Spec v1.0 - Criado em 2025-02-04*
