# Mission Control - Sistema de Notificações e @Mentions

> Especificação técnica para sistema de notificações em tempo real com suporte a @mentions, thread subscriptions e entrega multi-canal.

---

## 📋 Visão Geral

O sistema de notificações do Mission Control permite que usuários e agentes recebam alertas relevantes sobre atividades em projetos, tarefas, comentários e eventos do sistema. Inspirado nos padrões do GitHub e ferramentas colaborativas modernas.

### Objetivos

1. **@Mentions** - Detectar e processar menções em comentários e descrições
2. **Thread Subscriptions** - Inscrição automática em threads por participação
3. **Entrega Multi-canal** - Notificar via in-app, WhatsApp, email, etc.
4. **Integração com Agentes** - Entregar notificações para agentes via `sessions_send`
5. **UI de Notificações** - Inbox unificada com filtros e ações

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         MISSION CONTROL                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────┐    │
│  │   Eventos    │────▶│  Notification │────▶│   Delivery Service   │    │
│  │  (Comments,  │     │   Processor   │     │  (Multi-channel)     │    │
│  │   Tasks...)  │     └──────────────┘     └──────────────────────┘    │
│  └──────────────┘            │                        │                 │
│                              │                        │                 │
│                              ▼                        ▼                 │
│                    ┌──────────────┐     ┌──────────────────────────┐   │
│                    │ Subscription │     │       Channels           │   │
│                    │   Manager    │     │  ┌────┐ ┌────┐ ┌────┐   │   │
│                    └──────────────┘     │  │ WA │ │Email│ │Push│   │   │
│                                         │  └────┘ └────┘ └────┘   │   │
│                                         │  ┌────┐ ┌────┐          │   │
│                                         │  │Agent│ │Slack│         │   │
│                                         │  └────┘ └────┘          │   │
│                                         └──────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. 🔍 Detecção de @Mentions

### 1.1 Parser de Mentions

O parser identifica menções em qualquer campo de texto (comentários, descrições, títulos).

```typescript
// lib/notifications/mention-parser.ts

interface ParsedMention {
  type: 'user' | 'team' | 'agent';
  identifier: string;      // @john, @team-dev, @agent:lobo
  userId?: string;         // Resolved user ID
  teamId?: string;         // Resolved team ID
  agentId?: string;        // Resolved agent ID
  startIndex: number;
  endIndex: number;
  raw: string;
}

interface ParseResult {
  mentions: ParsedMention[];
  plainText: string;       // Text with mentions stripped
  htmlText: string;        // Text with mentions as links
}

const MENTION_PATTERNS = {
  // @username - matches users
  user: /@([a-zA-Z0-9_-]+)/g,
  
  // @team:name - matches teams
  team: /@team:([a-zA-Z0-9_-]+)/g,
  
  // @agent:id - matches agents
  agent: /@agent:([a-zA-Z0-9_-]+)/g,
  
  // @everyone, @here - special mentions
  special: /@(everyone|here|channel)/g,
};

export function parseMentions(
  text: string,
  context: { tenantId: string }
): Promise<ParseResult> {
  const mentions: ParsedMention[] = [];
  
  // Extract all mentions
  for (const [type, pattern] of Object.entries(MENTION_PATTERNS)) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      mentions.push({
        type: type as ParsedMention['type'],
        identifier: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        raw: match[0],
      });
    }
  }
  
  // Resolve identifiers to IDs
  const resolved = await resolveMentions(mentions, context);
  
  return {
    mentions: resolved,
    plainText: stripMentions(text),
    htmlText: mentionsToHtml(text, resolved),
  };
}
```

### 1.2 Resolução de Mentions

```typescript
// lib/notifications/mention-resolver.ts

async function resolveMentions(
  mentions: ParsedMention[],
  context: { tenantId: string }
): Promise<ParsedMention[]> {
  const resolved: ParsedMention[] = [];
  
  for (const mention of mentions) {
    switch (mention.type) {
      case 'user': {
        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { username: mention.identifier },
              { name: { contains: mention.identifier, mode: 'insensitive' } },
            ],
            memberships: { some: { tenantId: context.tenantId } },
          },
        });
        if (user) {
          resolved.push({ ...mention, userId: user.id });
        }
        break;
      }
      
      case 'team': {
        const team = await prisma.team.findFirst({
          where: {
            slug: mention.identifier,
            tenantId: context.tenantId,
          },
          include: { members: true },
        });
        if (team) {
          resolved.push({ ...mention, teamId: team.id });
        }
        break;
      }
      
      case 'agent': {
        const agent = await prisma.bot.findFirst({
          where: {
            slug: mention.identifier,
            tenantId: context.tenantId,
          },
        });
        if (agent) {
          resolved.push({ ...mention, agentId: agent.id });
        }
        break;
      }
    }
  }
  
  return resolved;
}
```

### 1.3 Uso em Comentários

```typescript
// api/comments/route.ts

export async function POST(req: Request) {
  const { content, threadId, parentId } = await req.json();
  const session = await getSession();
  
  // Parse mentions from content
  const { mentions, htmlText } = await parseMentions(content, {
    tenantId: session.tenantId,
  });
  
  // Create comment
  const comment = await prisma.comment.create({
    data: {
      content,
      htmlContent: htmlText,
      threadId,
      parentId,
      authorId: session.userId,
      mentions: mentions.map(m => ({
        type: m.type,
        targetId: m.userId || m.teamId || m.agentId,
        identifier: m.identifier,
      })),
    },
  });
  
  // Trigger notifications
  await notificationService.processCommentCreated(comment, mentions);
  
  return Response.json(comment);
}
```

---

## 2. 🔔 Thread Subscriptions

### 2.1 Modelo de Dados

```prisma
// prisma/schema.prisma

model Thread {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  // Thread metadata
  type        ThreadType  // TASK, ISSUE, DISCUSSION, PROJECT
  entityId    String      // ID da entidade relacionada
  entityType  String      // "Task", "Issue", etc.
  
  // Subscriptions
  subscriptions ThreadSubscription[]
  
  // Activity
  comments    Comment[]
  events      ThreadEvent[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([entityType, entityId])
}

model ThreadSubscription {
  id          String   @id @default(cuid())
  threadId    String
  thread      Thread   @relation(fields: [threadId], references: [id])
  
  // Subscriber (one of these)
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  agentId     String?
  agent       Bot?     @relation(fields: [agentId], references: [id])
  
  // Subscription config
  reason      SubscriptionReason
  level       SubscriptionLevel  @default(ALL)
  muted       Boolean  @default(false)
  mutedUntil  DateTime?
  
  // Channels for this subscription
  channels    NotificationChannel[]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@unique([threadId, userId])
  @@unique([threadId, agentId])
}

enum ThreadType {
  TASK
  ISSUE
  DISCUSSION
  PROJECT
  INCIDENT
  CUSTOM
}

enum SubscriptionReason {
  OWNER           // Created the entity
  ASSIGNED        // Was assigned to the entity
  MENTIONED       // Was @mentioned
  COMMENTED       // Commented on the thread
  MANUALLY        // Explicitly subscribed
  TEAM_MEMBER     // Member of a mentioned team
  WATCHING        // Watching the project/parent
}

enum SubscriptionLevel {
  ALL             // All activity
  PARTICIPATING   // Only when mentioned or replied to
  MENTIONS_ONLY   // Only direct mentions
  IGNORE          // No notifications (but stays subscribed)
}

enum NotificationChannel {
  IN_APP
  EMAIL
  WHATSAPP
  SLACK
  DISCORD
  PUSH
  AGENT_SESSION
}
```

### 2.2 Subscription Manager

```typescript
// lib/notifications/subscription-manager.ts

export class SubscriptionManager {
  
  /**
   * Auto-subscribe users based on action
   */
  async autoSubscribe(params: {
    threadId: string;
    userId?: string;
    agentId?: string;
    reason: SubscriptionReason;
  }): Promise<ThreadSubscription> {
    const { threadId, userId, agentId, reason } = params;
    
    // Check if already subscribed
    const existing = await prisma.threadSubscription.findFirst({
      where: {
        threadId,
        OR: [{ userId }, { agentId }].filter(Boolean),
      },
    });
    
    if (existing) {
      // Update reason if more significant
      const shouldUpdate = this.isMoreSignificant(reason, existing.reason);
      if (shouldUpdate) {
        return prisma.threadSubscription.update({
          where: { id: existing.id },
          data: { reason },
        });
      }
      return existing;
    }
    
    // Get default notification preferences
    const channels = await this.getDefaultChannels(userId || agentId!, !!agentId);
    
    return prisma.threadSubscription.create({
      data: {
        threadId,
        userId,
        agentId,
        reason,
        channels,
        level: reason === SubscriptionReason.MENTIONED 
          ? SubscriptionLevel.PARTICIPATING 
          : SubscriptionLevel.ALL,
      },
    });
  }
  
  /**
   * Get all subscribers for a thread
   */
  async getSubscribers(
    threadId: string,
    options: {
      excludeUserId?: string;
      minLevel?: SubscriptionLevel;
      channel?: NotificationChannel;
    } = {}
  ): Promise<ThreadSubscription[]> {
    return prisma.threadSubscription.findMany({
      where: {
        threadId,
        userId: options.excludeUserId 
          ? { not: options.excludeUserId } 
          : undefined,
        muted: false,
        OR: [
          { mutedUntil: null },
          { mutedUntil: { lt: new Date() } },
        ],
        ...(options.channel && {
          channels: { has: options.channel },
        }),
      },
      include: {
        user: true,
        agent: true,
      },
    });
  }
  
  /**
   * Subscribe when user comments
   */
  async onComment(comment: Comment): Promise<void> {
    await this.autoSubscribe({
      threadId: comment.threadId,
      userId: comment.authorId,
      reason: SubscriptionReason.COMMENTED,
    });
  }
  
  /**
   * Subscribe when user is mentioned
   */
  async onMention(params: {
    threadId: string;
    mentions: ParsedMention[];
  }): Promise<void> {
    const { threadId, mentions } = params;
    
    for (const mention of mentions) {
      if (mention.userId) {
        await this.autoSubscribe({
          threadId,
          userId: mention.userId,
          reason: SubscriptionReason.MENTIONED,
        });
      }
      
      if (mention.agentId) {
        await this.autoSubscribe({
          threadId,
          agentId: mention.agentId,
          reason: SubscriptionReason.MENTIONED,
        });
      }
      
      if (mention.teamId) {
        // Subscribe all team members
        const team = await prisma.team.findUnique({
          where: { id: mention.teamId },
          include: { members: true },
        });
        
        for (const member of team?.members || []) {
          await this.autoSubscribe({
            threadId,
            userId: member.userId,
            reason: SubscriptionReason.TEAM_MEMBER,
          });
        }
      }
    }
  }
  
  /**
   * Manual subscribe/unsubscribe
   */
  async subscribe(params: {
    threadId: string;
    userId: string;
    level?: SubscriptionLevel;
    channels?: NotificationChannel[];
  }): Promise<ThreadSubscription> {
    return prisma.threadSubscription.upsert({
      where: {
        threadId_userId: {
          threadId: params.threadId,
          userId: params.userId,
        },
      },
      create: {
        threadId: params.threadId,
        userId: params.userId,
        reason: SubscriptionReason.MANUALLY,
        level: params.level || SubscriptionLevel.ALL,
        channels: params.channels || [NotificationChannel.IN_APP],
      },
      update: {
        reason: SubscriptionReason.MANUALLY,
        level: params.level,
        channels: params.channels,
      },
    });
  }
  
  async unsubscribe(threadId: string, userId: string): Promise<void> {
    await prisma.threadSubscription.delete({
      where: {
        threadId_userId: { threadId, userId },
      },
    });
  }
  
  async mute(
    threadId: string, 
    userId: string, 
    duration?: number // hours
  ): Promise<void> {
    await prisma.threadSubscription.update({
      where: {
        threadId_userId: { threadId, userId },
      },
      data: {
        muted: true,
        mutedUntil: duration 
          ? new Date(Date.now() + duration * 60 * 60 * 1000)
          : null,
      },
    });
  }
  
  private isMoreSignificant(
    newReason: SubscriptionReason,
    oldReason: SubscriptionReason
  ): boolean {
    const priority: Record<SubscriptionReason, number> = {
      OWNER: 6,
      ASSIGNED: 5,
      MENTIONED: 4,
      COMMENTED: 3,
      MANUALLY: 2,
      TEAM_MEMBER: 1,
      WATCHING: 0,
    };
    return priority[newReason] > priority[oldReason];
  }
  
  private async getDefaultChannels(
    subscriberId: string,
    isAgent: boolean
  ): Promise<NotificationChannel[]> {
    if (isAgent) {
      return [NotificationChannel.AGENT_SESSION];
    }
    
    const prefs = await prisma.notificationPreference.findFirst({
      where: { userId: subscriberId },
    });
    
    return prefs?.defaultChannels || [NotificationChannel.IN_APP];
  }
}

export const subscriptionManager = new SubscriptionManager();
```

---

## 3. 🚀 Daemon de Notificações

### 3.1 Notification Processor

```typescript
// lib/notifications/processor.ts

export interface NotificationEvent {
  id: string;
  type: NotificationEventType;
  tenantId: string;
  threadId?: string;
  entityType: string;
  entityId: string;
  actorId: string;         // Who triggered the event
  actorType: 'user' | 'agent' | 'system';
  data: Record<string, any>;
  mentions?: ParsedMention[];
  createdAt: Date;
}

export enum NotificationEventType {
  // Comments
  COMMENT_CREATED = 'comment.created',
  COMMENT_REPLIED = 'comment.replied',
  COMMENT_EDITED = 'comment.edited',
  
  // Tasks
  TASK_ASSIGNED = 'task.assigned',
  TASK_STATUS_CHANGED = 'task.status_changed',
  TASK_DUE_SOON = 'task.due_soon',
  TASK_OVERDUE = 'task.overdue',
  
  // Projects
  PROJECT_MEMBER_ADDED = 'project.member_added',
  
  // Mentions
  MENTION_USER = 'mention.user',
  MENTION_TEAM = 'mention.team',
  MENTION_AGENT = 'mention.agent',
  
  // System
  ALERT_TRIGGERED = 'alert.triggered',
  BOT_ERROR = 'bot.error',
  BOT_HEALTH = 'bot.health',
}

export class NotificationProcessor {
  private queue: NotificationEvent[] = [];
  private processing = false;
  
  /**
   * Enqueue a notification event
   */
  async enqueue(event: Omit<NotificationEvent, 'id' | 'createdAt'>): Promise<void> {
    const notification: NotificationEvent = {
      ...event,
      id: crypto.randomUUID(),
      createdAt: new Date(),
    };
    
    // Persist to database
    await prisma.notificationEvent.create({
      data: {
        ...notification,
        data: notification.data as any,
        status: 'PENDING',
      },
    });
    
    // Add to in-memory queue for immediate processing
    this.queue.push(notification);
    
    // Start processing if not already
    this.processQueue();
  }
  
  /**
   * Process notification queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;
    
    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      
      try {
        await this.processEvent(event);
        
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: { status: 'DELIVERED', processedAt: new Date() },
        });
      } catch (error) {
        console.error(`Failed to process notification ${event.id}:`, error);
        
        await prisma.notificationEvent.update({
          where: { id: event.id },
          data: { 
            status: 'FAILED', 
            error: error instanceof Error ? error.message : 'Unknown error',
            retryCount: { increment: 1 },
          },
        });
        
        // Re-queue for retry if under limit
        const updated = await prisma.notificationEvent.findUnique({
          where: { id: event.id },
        });
        if (updated && updated.retryCount < 3) {
          setTimeout(() => this.queue.push(event), 5000 * updated.retryCount);
        }
      }
    }
    
    this.processing = false;
  }
  
  /**
   * Process a single notification event
   */
  private async processEvent(event: NotificationEvent): Promise<void> {
    // Get or create thread
    let thread = event.threadId 
      ? await prisma.thread.findUnique({ where: { id: event.threadId } })
      : null;
    
    if (!thread && event.entityId) {
      thread = await prisma.thread.upsert({
        where: {
          entityType_entityId: {
            entityType: event.entityType,
            entityId: event.entityId,
          },
        },
        create: {
          tenantId: event.tenantId,
          type: this.mapEntityToThreadType(event.entityType),
          entityType: event.entityType,
          entityId: event.entityId,
        },
        update: {},
      });
    }
    
    // Handle mentions - subscribe mentioned users
    if (event.mentions?.length && thread) {
      await subscriptionManager.onMention({
        threadId: thread.id,
        mentions: event.mentions,
      });
    }
    
    // Get all subscribers to notify
    const subscribers = await subscriptionManager.getSubscribers(thread?.id || '', {
      excludeUserId: event.actorType === 'user' ? event.actorId : undefined,
    });
    
    // Add directly mentioned users (even if not subscribed)
    const directMentions = event.mentions?.filter(m => m.userId || m.agentId) || [];
    
    // Create notification records
    const notifications = await this.createNotifications(event, subscribers, directMentions);
    
    // Deliver via channels
    await this.deliverNotifications(notifications);
  }
  
  /**
   * Create notification records for each recipient
   */
  private async createNotifications(
    event: NotificationEvent,
    subscribers: ThreadSubscription[],
    directMentions: ParsedMention[]
  ): Promise<Notification[]> {
    const notifications: Notification[] = [];
    const seen = new Set<string>();
    
    // Notifications for subscribers
    for (const sub of subscribers) {
      const key = sub.userId || sub.agentId!;
      if (seen.has(key)) continue;
      seen.add(key);
      
      const notification = await prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          eventType: event.type,
          userId: sub.userId,
          agentId: sub.agentId,
          threadId: sub.threadId,
          entityType: event.entityType,
          entityId: event.entityId,
          title: this.generateTitle(event),
          body: this.generateBody(event),
          data: event.data,
          channels: sub.channels,
          reason: sub.reason === SubscriptionReason.MENTIONED 
            ? 'MENTIONED' 
            : 'SUBSCRIBED',
        },
      });
      
      notifications.push(notification);
    }
    
    // Direct mentions (may not be subscribed)
    for (const mention of directMentions) {
      const key = mention.userId || mention.agentId!;
      if (seen.has(key)) continue;
      seen.add(key);
      
      const channels = await this.getChannelsForMention(mention);
      
      const notification = await prisma.notification.create({
        data: {
          tenantId: event.tenantId,
          eventType: event.type,
          userId: mention.userId,
          agentId: mention.agentId,
          entityType: event.entityType,
          entityId: event.entityId,
          title: this.generateTitle(event),
          body: this.generateBody(event),
          data: event.data,
          channels,
          reason: 'MENTIONED',
        },
      });
      
      notifications.push(notification);
    }
    
    return notifications;
  }
  
  /**
   * Deliver notifications via appropriate channels
   */
  private async deliverNotifications(notifications: Notification[]): Promise<void> {
    for (const notification of notifications) {
      for (const channel of notification.channels) {
        try {
          await deliveryService.deliver(notification, channel);
          
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              channel,
              status: 'DELIVERED',
              deliveredAt: new Date(),
            },
          });
        } catch (error) {
          await prisma.notificationDelivery.create({
            data: {
              notificationId: notification.id,
              channel,
              status: 'FAILED',
              error: error instanceof Error ? error.message : 'Unknown',
            },
          });
        }
      }
    }
  }
  
  private generateTitle(event: NotificationEvent): string {
    const templates: Record<NotificationEventType, string> = {
      [NotificationEventType.COMMENT_CREATED]: 'New comment on {{entity}}',
      [NotificationEventType.COMMENT_REPLIED]: '{{actor}} replied to your comment',
      [NotificationEventType.TASK_ASSIGNED]: 'You were assigned to {{entity}}',
      [NotificationEventType.TASK_STATUS_CHANGED]: '{{entity}} status changed',
      [NotificationEventType.MENTION_USER]: '{{actor}} mentioned you',
      // ... more templates
    };
    
    return this.interpolate(templates[event.type] || 'New notification', event);
  }
  
  private generateBody(event: NotificationEvent): string {
    // Generate notification body based on event type and data
    return event.data.preview || event.data.content?.slice(0, 200) || '';
  }
  
  private interpolate(template: string, event: NotificationEvent): string {
    return template
      .replace('{{actor}}', event.data.actorName || 'Someone')
      .replace('{{entity}}', event.data.entityName || 'an item');
  }
  
  private mapEntityToThreadType(entityType: string): ThreadType {
    const mapping: Record<string, ThreadType> = {
      Task: ThreadType.TASK,
      Issue: ThreadType.ISSUE,
      Discussion: ThreadType.DISCUSSION,
      Project: ThreadType.PROJECT,
    };
    return mapping[entityType] || ThreadType.CUSTOM;
  }
  
  private async getChannelsForMention(mention: ParsedMention): Promise<NotificationChannel[]> {
    if (mention.agentId) {
      return [NotificationChannel.AGENT_SESSION];
    }
    
    const prefs = await prisma.notificationPreference.findFirst({
      where: { userId: mention.userId },
    });
    
    // Mentions always get in-app + user's preferred channels
    return [
      NotificationChannel.IN_APP,
      ...(prefs?.mentionChannels || []),
    ];
  }
}

export const notificationProcessor = new NotificationProcessor();
```

### 3.2 Poll Daemon (Cron)

```typescript
// lib/notifications/daemon.ts

export class NotificationDaemon {
  private running = false;
  private pollInterval: NodeJS.Timer | null = null;
  
  /**
   * Start the notification daemon
   */
  start(intervalMs = 5000): void {
    if (this.running) return;
    this.running = true;
    
    console.log('📬 Notification daemon started');
    
    // Poll for pending notifications
    this.pollInterval = setInterval(() => this.poll(), intervalMs);
    
    // Initial poll
    this.poll();
  }
  
  /**
   * Stop the daemon
   */
  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    console.log('📬 Notification daemon stopped');
  }
  
  /**
   * Poll for pending notifications
   */
  private async poll(): Promise<void> {
    try {
      // Get pending events
      const pending = await prisma.notificationEvent.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { retryCount: { lt: 3 } },
            { retryCount: null },
          ],
        },
        orderBy: { createdAt: 'asc' },
        take: 100,
      });
      
      if (pending.length > 0) {
        console.log(`📬 Processing ${pending.length} pending notifications`);
        
        for (const event of pending) {
          await notificationProcessor.enqueue(event as any);
        }
      }
      
      // Check for scheduled notifications
      await this.checkScheduled();
      
      // Check for due date reminders
      await this.checkDueDates();
      
    } catch (error) {
      console.error('Notification daemon error:', error);
    }
  }
  
  /**
   * Check for scheduled notifications
   */
  private async checkScheduled(): Promise<void> {
    const due = await prisma.scheduledNotification.findMany({
      where: {
        scheduledFor: { lte: new Date() },
        sent: false,
      },
    });
    
    for (const scheduled of due) {
      await notificationProcessor.enqueue({
        type: scheduled.eventType as NotificationEventType,
        tenantId: scheduled.tenantId,
        entityType: scheduled.entityType,
        entityId: scheduled.entityId,
        actorId: 'system',
        actorType: 'system',
        data: scheduled.data as any,
      });
      
      await prisma.scheduledNotification.update({
        where: { id: scheduled.id },
        data: { sent: true, sentAt: new Date() },
      });
    }
  }
  
  /**
   * Check for task due date reminders
   */
  private async checkDueDates(): Promise<void> {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Tasks due in 24 hours
    const dueSoon = await prisma.task.findMany({
      where: {
        dueDate: {
          gte: now,
          lte: in24h,
        },
        status: { not: 'COMPLETED' },
        dueSoonNotified: false,
      },
      include: {
        assignee: true,
        project: true,
      },
    });
    
    for (const task of dueSoon) {
      if (task.assigneeId) {
        await notificationProcessor.enqueue({
          type: NotificationEventType.TASK_DUE_SOON,
          tenantId: task.tenantId,
          entityType: 'Task',
          entityId: task.id,
          actorId: 'system',
          actorType: 'system',
          data: {
            taskTitle: task.title,
            dueDate: task.dueDate,
            projectName: task.project?.name,
          },
        });
      }
      
      await prisma.task.update({
        where: { id: task.id },
        data: { dueSoonNotified: true },
      });
    }
    
    // Overdue tasks
    const overdue = await prisma.task.findMany({
      where: {
        dueDate: { lt: now },
        status: { not: 'COMPLETED' },
        overdueNotified: false,
      },
      include: {
        assignee: true,
        project: true,
      },
    });
    
    for (const task of overdue) {
      if (task.assigneeId) {
        await notificationProcessor.enqueue({
          type: NotificationEventType.TASK_OVERDUE,
          tenantId: task.tenantId,
          entityType: 'Task',
          entityId: task.id,
          actorId: 'system',
          actorType: 'system',
          data: {
            taskTitle: task.title,
            dueDate: task.dueDate,
            projectName: task.project?.name,
          },
        });
      }
      
      await prisma.task.update({
        where: { id: task.id },
        data: { overdueNotified: true },
      });
    }
  }
}

export const notificationDaemon = new NotificationDaemon();
```

---

## 4. 🔌 Integração com Clawdbot

### 4.1 Agent Delivery Service

```typescript
// lib/notifications/delivery/agent.ts

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AgentDeliveryService {
  
  /**
   * Send notification to an agent via Clawdbot
   */
  async deliver(notification: Notification, agent: Bot): Promise<void> {
    const message = this.formatMessage(notification);
    
    // Method 1: Via session-id (direct to agent's session)
    if (agent.sessionKey) {
      await this.sendToSession(agent.sessionKey, message);
      return;
    }
    
    // Method 2: Via system event (triggers heartbeat)
    await this.sendSystemEvent(agent, message);
  }
  
  /**
   * Send message directly to an agent session
   */
  private async sendToSession(sessionKey: string, message: string): Promise<void> {
    // Use clawdbot agent command with session targeting
    const command = `clawdbot agent \
      --session-id "${sessionKey}" \
      --message "${this.escapeShell(message)}" \
      --json`;
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        timeout: 60000,
      });
      
      if (stderr) {
        console.warn('Agent delivery warning:', stderr);
      }
      
      const result = JSON.parse(stdout);
      if (!result.ok) {
        throw new Error(result.error || 'Agent delivery failed');
      }
    } catch (error) {
      console.error('Failed to deliver to agent session:', error);
      throw error;
    }
  }
  
  /**
   * Send via system event (wakes agent on next heartbeat)
   */
  private async sendSystemEvent(agent: Bot, message: string): Promise<void> {
    const eventText = `[NOTIFICATION] ${message}`;
    
    const command = `clawdbot system event \
      --text "${this.escapeShell(eventText)}" \
      --mode now \
      --json`;
    
    try {
      const { stdout } = await execAsync(command, {
        timeout: 30000,
      });
      
      const result = JSON.parse(stdout);
      if (!result.ok) {
        throw new Error(result.error || 'System event failed');
      }
    } catch (error) {
      console.error('Failed to send system event:', error);
      throw error;
    }
  }
  
  /**
   * Format notification for agent consumption
   */
  private formatMessage(notification: Notification): string {
    return `
📬 **${notification.title}**

${notification.body}

---
Type: ${notification.eventType}
Entity: ${notification.entityType}#${notification.entityId}
Time: ${notification.createdAt.toISOString()}
    `.trim();
  }
  
  /**
   * Alternative: Use Gateway WebSocket API directly
   */
  async sendViaGatewayApi(sessionKey: string, message: string): Promise<void> {
    const gatewayUrl = process.env.CLAWDBOT_GATEWAY_URL || 'ws://localhost:18789';
    const token = process.env.CLAWDBOT_GATEWAY_TOKEN;
    
    // Use gateway call for more control
    const command = `clawdbot gateway call agent.turn \
      --params '${JSON.stringify({
        sessionKey,
        message,
        source: 'notification-service',
      })}' \
      --url "${gatewayUrl}" \
      ${token ? `--token "${token}"` : ''} \
      --json`;
    
    const { stdout } = await execAsync(command, { timeout: 60000 });
    const result = JSON.parse(stdout);
    
    if (!result.ok) {
      throw new Error(result.error || 'Gateway call failed');
    }
  }
  
  private escapeShell(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}

export const agentDeliveryService = new AgentDeliveryService();
```

### 4.2 Integration com sessions_send (WebSocket)

```typescript
// lib/notifications/delivery/gateway-client.ts

import WebSocket from 'ws';

export class GatewayClient {
  private ws: WebSocket | null = null;
  private connected = false;
  private requestId = 0;
  private pending = new Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }>();
  
  constructor(
    private url = process.env.CLAWDBOT_GATEWAY_URL || 'ws://localhost:18789',
    private token = process.env.CLAWDBOT_GATEWAY_TOKEN
  ) {}
  
  /**
   * Connect to the Clawdbot Gateway
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams();
      if (this.token) params.set('auth.token', this.token);
      
      this.ws = new WebSocket(`${this.url}?${params}`);
      
      this.ws.on('open', () => {
        this.connected = true;
        console.log('🔌 Connected to Clawdbot Gateway');
        resolve();
      });
      
      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.id && this.pending.has(msg.id)) {
            const { resolve, reject } = this.pending.get(msg.id)!;
            this.pending.delete(msg.id);
            
            if (msg.error) {
              reject(new Error(msg.error.message));
            } else {
              resolve(msg.result);
            }
          }
        } catch (e) {
          console.error('Failed to parse gateway message:', e);
        }
      });
      
      this.ws.on('error', (error) => {
        console.error('Gateway WebSocket error:', error);
        reject(error);
      });
      
      this.ws.on('close', () => {
        this.connected = false;
        console.log('🔌 Disconnected from Clawdbot Gateway');
      });
    });
  }
  
  /**
   * Send a message to a specific session
   */
  async sendToSession(sessionKey: string, message: string): Promise<any> {
    await this.connect();
    
    return this.call('sessions.inject', {
      sessionKey,
      messages: [{
        role: 'user',
        content: message,
        source: 'notification-service',
      }],
      triggerTurn: true,
    });
  }
  
  /**
   * Make a JSON-RPC call to the gateway
   */
  private async call(method: string, params: any): Promise<any> {
    if (!this.ws || !this.connected) {
      throw new Error('Not connected to gateway');
    }
    
    const id = ++this.requestId;
    
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      
      this.ws!.send(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method,
        params,
      }));
      
      // Timeout after 60s
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error('Gateway call timeout'));
        }
      }, 60000);
    });
  }
  
  /**
   * Disconnect from gateway
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }
}

export const gatewayClient = new GatewayClient();
```

---

## 5. 📬 Delivery Service (Multi-canal)

### 5.1 Service Principal

```typescript
// lib/notifications/delivery/service.ts

export class DeliveryService {
  private handlers: Map<NotificationChannel, ChannelHandler> = new Map();
  
  constructor() {
    this.registerHandler(NotificationChannel.IN_APP, new InAppHandler());
    this.registerHandler(NotificationChannel.EMAIL, new EmailHandler());
    this.registerHandler(NotificationChannel.WHATSAPP, new WhatsAppHandler());
    this.registerHandler(NotificationChannel.SLACK, new SlackHandler());
    this.registerHandler(NotificationChannel.PUSH, new PushHandler());
    this.registerHandler(NotificationChannel.AGENT_SESSION, new AgentHandler());
  }
  
  registerHandler(channel: NotificationChannel, handler: ChannelHandler): void {
    this.handlers.set(channel, handler);
  }
  
  async deliver(notification: Notification, channel: NotificationChannel): Promise<void> {
    const handler = this.handlers.get(channel);
    if (!handler) {
      throw new Error(`No handler for channel: ${channel}`);
    }
    
    await handler.send(notification);
  }
}

interface ChannelHandler {
  send(notification: Notification): Promise<void>;
}
```

### 5.2 WhatsApp Handler

```typescript
// lib/notifications/delivery/whatsapp.ts

export class WhatsAppHandler implements ChannelHandler {
  
  async send(notification: Notification): Promise<void> {
    // Get user's WhatsApp number
    const user = await prisma.user.findUnique({
      where: { id: notification.userId! },
      include: { notificationPreferences: true },
    });
    
    if (!user?.phone) {
      throw new Error('User has no WhatsApp number');
    }
    
    const message = this.formatMessage(notification);
    
    // Use clawdbot message send
    const command = `clawdbot message send \
      --channel whatsapp \
      --target "${user.phone}" \
      --message "${this.escapeMessage(message)}"`;
    
    await execAsync(command, { timeout: 30000 });
  }
  
  private formatMessage(notification: Notification): string {
    const emoji = this.getEmoji(notification.eventType);
    
    return `${emoji} *${notification.title}*

${notification.body}

_Mission Control_`;
  }
  
  private getEmoji(eventType: string): string {
    const emojis: Record<string, string> = {
      'comment.created': '💬',
      'comment.replied': '↩️',
      'task.assigned': '📋',
      'task.status_changed': '🔄',
      'task.due_soon': '⏰',
      'task.overdue': '🚨',
      'mention.user': '👋',
      'alert.triggered': '⚠️',
    };
    return emojis[eventType] || '🔔';
  }
  
  private escapeMessage(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }
}
```

### 5.3 In-App Handler (WebSocket Push)

```typescript
// lib/notifications/delivery/in-app.ts

export class InAppHandler implements ChannelHandler {
  
  async send(notification: Notification): Promise<void> {
    // Store in database (already done by processor)
    
    // Push via WebSocket to connected clients
    const userId = notification.userId;
    if (userId) {
      await pusherServer.trigger(`user-${userId}`, 'notification', {
        id: notification.id,
        type: notification.eventType,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        createdAt: notification.createdAt,
        read: false,
      });
    }
    
    // Also push to tenant channel for broadcast
    await pusherServer.trigger(
      `tenant-${notification.tenantId}`,
      'notification-activity',
      {
        userId: notification.userId,
        type: notification.eventType,
      }
    );
  }
}
```

### 5.4 Email Handler

```typescript
// lib/notifications/delivery/email.ts

import { Resend } from 'resend';

export class EmailHandler implements ChannelHandler {
  private resend = new Resend(process.env.RESEND_API_KEY);
  
  async send(notification: Notification): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: notification.userId! },
    });
    
    if (!user?.email) {
      throw new Error('User has no email');
    }
    
    // Check email preferences (immediate vs digest)
    const prefs = await prisma.notificationPreference.findFirst({
      where: { userId: user.id },
    });
    
    if (prefs?.emailDigest) {
      // Queue for digest
      await prisma.emailDigestQueue.create({
        data: {
          userId: user.id,
          notificationId: notification.id,
        },
      });
      return;
    }
    
    // Send immediately
    await this.resend.emails.send({
      from: 'Mission Control <notifications@missioncontrol.app>',
      to: user.email,
      subject: notification.title,
      html: this.renderEmail(notification),
    });
  }
  
  private renderEmail(notification: Notification): string {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">${notification.title}</h2>
        <p style="color: #666; line-height: 1.6;">${notification.body}</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">
          You received this notification because you are subscribed to updates.
          <a href="${process.env.APP_URL}/settings/notifications">Manage preferences</a>
        </p>
      </div>
    `;
  }
}
```

---

## 6. 🎨 UI de Notificações

### 6.1 Notification Inbox Component

```tsx
// components/notifications/notification-inbox.tsx

'use client';

import { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Filter } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { NotificationItem } from './notification-item';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function NotificationInbox() {
  const {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    filter,
    setFilter,
  } = useNotifications();
  
  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-xl font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={markAllAsRead}
            disabled={unreadCount === 0}
          >
            <Check className="h-4 w-4 mr-1" />
            Mark all read
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <Filter className="h-4 w-4 mr-1" />
                Filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setFilter('all')}>
                All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('unread')}>
                Unread
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('mentions')}>
                Mentions
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setFilter('assigned')}>
                Assigned to me
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {/* Tabs */}
      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="inbox" className="flex-1">
            Inbox
          </TabsTrigger>
          <TabsTrigger value="saved" className="flex-1">
            Saved
          </TabsTrigger>
          <TabsTrigger value="done" className="flex-1">
            Done
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="inbox" className="mt-4">
          {loading ? (
            <NotificationSkeleton />
          ) : notifications.length === 0 ? (
            <EmptyState message="No notifications" />
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  onDelete={() => deleteNotification(notification.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="saved">
          <SavedNotifications />
        </TabsContent>
        
        <TabsContent value="done">
          <DoneNotifications />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 6.2 Notification Item

```tsx
// components/notifications/notification-item.tsx

'use client';

import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  MessageSquare, 
  UserPlus, 
  AlertCircle, 
  Clock,
  MoreHorizontal,
  Bookmark,
  Check,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: () => void;
  onDelete: () => void;
  onSave?: () => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onSave,
}: NotificationItemProps) {
  const icon = getNotificationIcon(notification.eventType);
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });
  
  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3 rounded-lg border transition-colors',
        notification.read
          ? 'bg-background'
          : 'bg-primary/5 border-primary/20'
      )}
    >
      {/* Icon */}
      <div className={cn(
        'p-2 rounded-full',
        notification.read ? 'bg-muted' : 'bg-primary/10'
      )}>
        {icon}
      </div>
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className={cn(
              'text-sm',
              !notification.read && 'font-medium'
            )}>
              {notification.title}
            </p>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {notification.body}
            </p>
          </div>
          
          {/* Actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!notification.read && (
                <DropdownMenuItem onClick={onMarkAsRead}>
                  <Check className="h-4 w-4 mr-2" />
                  Mark as read
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={onSave}>
                <Bookmark className="h-4 w-4 mr-2" />
                Save for later
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {/* Meta */}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">{timeAgo}</span>
          {notification.reason === 'MENTIONED' && (
            <span className="text-xs bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
              Mentioned
            </span>
          )}
        </div>
      </div>
      
      {/* Unread indicator */}
      {!notification.read && (
        <div className="w-2 h-2 bg-primary rounded-full" />
      )}
    </div>
  );
}

function getNotificationIcon(eventType: string) {
  const icons: Record<string, React.ReactNode> = {
    'comment.created': <MessageSquare className="h-4 w-4 text-blue-500" />,
    'comment.replied': <MessageSquare className="h-4 w-4 text-blue-500" />,
    'task.assigned': <UserPlus className="h-4 w-4 text-green-500" />,
    'task.due_soon': <Clock className="h-4 w-4 text-yellow-500" />,
    'task.overdue': <AlertCircle className="h-4 w-4 text-red-500" />,
    'mention.user': <MessageSquare className="h-4 w-4 text-purple-500" />,
    'alert.triggered': <AlertCircle className="h-4 w-4 text-orange-500" />,
  };
  
  return icons[eventType] || <Bell className="h-4 w-4" />;
}
```

### 6.3 Notification Bell (Header)

```tsx
// components/notifications/notification-bell.tsx

'use client';

import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/use-notifications';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { NotificationItem } from './notification-item';
import Link from 'next/link';

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead } = useNotifications();
  const recentNotifications = notifications.slice(0, 5);
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {recentNotifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No notifications
            </div>
          ) : (
            <div className="divide-y">
              {recentNotifications.map((notification) => (
                <div key={notification.id} className="p-2">
                  <NotificationItem
                    notification={notification}
                    onMarkAsRead={() => markAsRead(notification.id)}
                    onDelete={() => {}}
                    compact
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-2 border-t">
          <Link href="/notifications">
            <Button variant="ghost" className="w-full">
              View all notifications
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 6.4 Notification Preferences

```tsx
// components/notifications/notification-preferences.tsx

'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function NotificationPreferences() {
  const [preferences, setPreferences] = useState({
    inApp: true,
    email: true,
    emailDigest: false,
    whatsapp: false,
    push: true,
    
    // Event types
    mentions: true,
    comments: true,
    taskAssigned: true,
    taskDue: true,
    projectUpdates: true,
    
    // Quiet hours
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
  });
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Delivery Channels</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="in-app">In-app notifications</Label>
            <Switch
              id="in-app"
              checked={preferences.inApp}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, inApp: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="email">Email notifications</Label>
            <Switch
              id="email"
              checked={preferences.email}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, email: checked })
              }
            />
          </div>
          
          {preferences.email && (
            <div className="flex items-center justify-between pl-4">
              <Label htmlFor="email-digest" className="text-sm text-muted-foreground">
                Daily digest instead of individual emails
              </Label>
              <Switch
                id="email-digest"
                checked={preferences.emailDigest}
                onCheckedChange={(checked) =>
                  setPreferences({ ...preferences, emailDigest: checked })
                }
              />
            </div>
          )}
          
          <div className="flex items-center justify-between">
            <Label htmlFor="whatsapp">WhatsApp notifications</Label>
            <Switch
              id="whatsapp"
              checked={preferences.whatsapp}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, whatsapp: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="push">Push notifications</Label>
            <Switch
              id="push"
              checked={preferences.push}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, push: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Notification Types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="mentions">@Mentions</Label>
            <Switch
              id="mentions"
              checked={preferences.mentions}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, mentions: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="comments">Comments on my threads</Label>
            <Switch
              id="comments"
              checked={preferences.comments}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, comments: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="task-assigned">Task assignments</Label>
            <Switch
              id="task-assigned"
              checked={preferences.taskAssigned}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, taskAssigned: checked })
              }
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="task-due">Due date reminders</Label>
            <Switch
              id="task-due"
              checked={preferences.taskDue}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, taskDue: checked })
              }
            />
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Quiet Hours</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="quiet-hours">Enable quiet hours</Label>
            <Switch
              id="quiet-hours"
              checked={preferences.quietHoursEnabled}
              onCheckedChange={(checked) =>
                setPreferences({ ...preferences, quietHoursEnabled: checked })
              }
            />
          </div>
          
          {preferences.quietHoursEnabled && (
            <div className="flex gap-4">
              <div>
                <Label htmlFor="quiet-start">Start</Label>
                <input
                  type="time"
                  id="quiet-start"
                  value={preferences.quietHoursStart}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursStart: e.target.value })
                  }
                  className="block mt-1 px-3 py-2 border rounded-md"
                />
              </div>
              <div>
                <Label htmlFor="quiet-end">End</Label>
                <input
                  type="time"
                  id="quiet-end"
                  value={preferences.quietHoursEnd}
                  onChange={(e) =>
                    setPreferences({ ...preferences, quietHoursEnd: e.target.value })
                  }
                  className="block mt-1 px-3 py-2 border rounded-md"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Button>Save Preferences</Button>
    </div>
  );
}
```

---

## 7. 📊 Database Schema Completo

```prisma
// prisma/schema.prisma - Notification models

model Notification {
  id          String   @id @default(cuid())
  tenantId    String
  tenant      Tenant   @relation(fields: [tenantId], references: [id])
  
  // Recipient (one of these)
  userId      String?
  user        User?    @relation(fields: [userId], references: [id])
  agentId     String?
  agent       Bot?     @relation(fields: [agentId], references: [id])
  
  // Event info
  eventType   String
  threadId    String?
  thread      Thread?  @relation(fields: [threadId], references: [id])
  entityType  String
  entityId    String
  
  // Content
  title       String
  body        String
  data        Json?
  
  // Delivery
  channels    NotificationChannel[]
  reason      NotificationReason
  
  // Status
  read        Boolean  @default(false)
  readAt      DateTime?
  saved       Boolean  @default(false)
  done        Boolean  @default(false)
  
  // Timestamps
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  // Delivery records
  deliveries  NotificationDelivery[]
  
  @@index([userId, read, createdAt])
  @@index([tenantId, createdAt])
}

model NotificationEvent {
  id          String   @id @default(cuid())
  tenantId    String
  
  type        String
  threadId    String?
  entityType  String
  entityId    String
  actorId     String
  actorType   String
  data        Json
  
  status      NotificationEventStatus @default(PENDING)
  processedAt DateTime?
  error       String?
  retryCount  Int      @default(0)
  
  createdAt   DateTime @default(now())
  
  @@index([status, createdAt])
}

model NotificationDelivery {
  id              String   @id @default(cuid())
  notificationId  String
  notification    Notification @relation(fields: [notificationId], references: [id])
  
  channel         NotificationChannel
  status          DeliveryStatus
  deliveredAt     DateTime?
  error           String?
  
  createdAt       DateTime @default(now())
  
  @@index([notificationId])
}

model NotificationPreference {
  id          String   @id @default(cuid())
  userId      String   @unique
  user        User     @relation(fields: [userId], references: [id])
  
  // Channels
  defaultChannels    NotificationChannel[]
  mentionChannels    NotificationChannel[]
  
  // Email
  emailDigest        Boolean @default(false)
  emailDigestTime    String  @default("09:00")
  
  // Quiet hours
  quietHoursEnabled  Boolean @default(false)
  quietHoursStart    String  @default("22:00")
  quietHoursEnd      String  @default("08:00")
  quietHoursTimezone String  @default("UTC")
  
  // Event preferences
  mentions           Boolean @default(true)
  comments           Boolean @default(true)
  taskAssigned       Boolean @default(true)
  taskDue            Boolean @default(true)
  projectUpdates     Boolean @default(true)
  systemAlerts       Boolean @default(true)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ScheduledNotification {
  id          String   @id @default(cuid())
  tenantId    String
  
  eventType   String
  entityType  String
  entityId    String
  data        Json
  
  scheduledFor DateTime
  sent         Boolean  @default(false)
  sentAt       DateTime?
  
  createdAt    DateTime @default(now())
  
  @@index([scheduledFor, sent])
}

model EmailDigestQueue {
  id              String   @id @default(cuid())
  userId          String
  notificationId  String
  
  createdAt       DateTime @default(now())
  
  @@index([userId])
}

enum NotificationEventStatus {
  PENDING
  PROCESSING
  DELIVERED
  FAILED
}

enum DeliveryStatus {
  PENDING
  DELIVERED
  FAILED
}

enum NotificationReason {
  MENTIONED
  SUBSCRIBED
  ASSIGNED
  OWNER
  SYSTEM
}
```

---

## 8. 🔌 API Routes

```typescript
// app/api/notifications/route.ts

export async function GET(req: Request) {
  const session = await getSession();
  const { searchParams } = new URL(req.url);
  
  const filter = searchParams.get('filter') || 'all';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  
  const where: Prisma.NotificationWhereInput = {
    userId: session.userId,
    ...(filter === 'unread' && { read: false }),
    ...(filter === 'mentions' && { reason: 'MENTIONED' }),
    ...(filter === 'saved' && { saved: true }),
    ...(filter === 'done' && { done: true }),
  };
  
  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        thread: true,
      },
    }),
    prisma.notification.count({ where }),
  ]);
  
  return Response.json({
    notifications,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// Mark notification as read
export async function PATCH(req: Request) {
  const session = await getSession();
  const { notificationIds, action } = await req.json();
  
  const data: Prisma.NotificationUpdateInput = {};
  
  switch (action) {
    case 'read':
      data.read = true;
      data.readAt = new Date();
      break;
    case 'unread':
      data.read = false;
      data.readAt = null;
      break;
    case 'save':
      data.saved = true;
      break;
    case 'unsave':
      data.saved = false;
      break;
    case 'done':
      data.done = true;
      data.read = true;
      break;
  }
  
  await prisma.notification.updateMany({
    where: {
      id: { in: notificationIds },
      userId: session.userId,
    },
    data,
  });
  
  return Response.json({ ok: true });
}

// app/api/notifications/unread-count/route.ts
export async function GET() {
  const session = await getSession();
  
  const count = await prisma.notification.count({
    where: {
      userId: session.userId,
      read: false,
    },
  });
  
  return Response.json({ count });
}

// app/api/threads/[id]/subscribe/route.ts
export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  const { level, channels } = await req.json();
  
  const subscription = await subscriptionManager.subscribe({
    threadId: params.id,
    userId: session.userId,
    level,
    channels,
  });
  
  return Response.json(subscription);
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  
  await subscriptionManager.unsubscribe(params.id, session.userId);
  
  return Response.json({ ok: true });
}
```

---

## 9. ⚡ Real-time Updates (Pusher/WebSocket)

```typescript
// lib/pusher.ts

import PusherServer from 'pusher';
import PusherClient from 'pusher-js';

export const pusherServer = new PusherServer({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export const pusherClient = new PusherClient(
  process.env.NEXT_PUBLIC_PUSHER_KEY!,
  {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  }
);

// hooks/use-notifications.ts
export function useNotifications() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  useEffect(() => {
    if (!session?.user?.id) return;
    
    // Subscribe to user channel
    const channel = pusherClient.subscribe(`user-${session.user.id}`);
    
    channel.bind('notification', (data: Notification) => {
      setNotifications((prev) => [data, ...prev]);
      setUnreadCount((prev) => prev + 1);
      
      // Show toast
      toast({
        title: data.title,
        description: data.body,
      });
    });
    
    return () => {
      pusherClient.unsubscribe(`user-${session.user.id}`);
    };
  }, [session?.user?.id]);
  
  // Fetch initial notifications
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, []);
  
  const fetchNotifications = async () => {
    const res = await fetch('/api/notifications');
    const data = await res.json();
    setNotifications(data.notifications);
  };
  
  const fetchUnreadCount = async () => {
    const res = await fetch('/api/notifications/unread-count');
    const data = await res.json();
    setUnreadCount(data.count);
  };
  
  const markAsRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: [id], action: 'read' }),
    });
    
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };
  
  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    
    await fetch('/api/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notificationIds: unreadIds, action: 'read' }),
    });
    
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };
  
  return {
    notifications,
    unreadCount,
    loading: false,
    markAsRead,
    markAllAsRead,
    deleteNotification: () => {},
    filter: 'all',
    setFilter: () => {},
  };
}
```

---

## 10. 📋 Roadmap de Implementação

### Fase 1: Fundação (1-2 semanas)
- [ ] Schema Prisma completo
- [ ] Parser de @mentions
- [ ] Subscription Manager
- [ ] NotificationProcessor básico
- [ ] In-app delivery

### Fase 2: Entrega Multi-canal (1 semana)
- [ ] Email delivery (Resend)
- [ ] WhatsApp delivery (via Clawdbot)
- [ ] Push notifications (web)
- [ ] Pusher real-time

### Fase 3: Integração com Agentes (1 semana)
- [ ] Agent delivery service
- [ ] Gateway WebSocket client
- [ ] System events integration
- [ ] Session targeting

### Fase 4: UI Completa (1 semana)
- [ ] Notification inbox
- [ ] Notification bell
- [ ] Preferences page
- [ ] Thread subscription UI

### Fase 5: Otimização (1 semana)
- [ ] Email digest
- [ ] Quiet hours
- [ ] Rate limiting
- [ ] Analytics

---

## 📚 Referências

- [GitHub Notifications Docs](https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications)
- [Design Patterns for Notification Systems](https://www.suprsend.com/post/top-6-design-patterns-for-building-effective-notification-systems-for-developers)
- [Observer Pattern](https://refactoring.guru/design-patterns/observer)
- [Pusher Channels](https://pusher.com/channels)
- [Clawdbot Gateway API](https://docs.clawd.bot/cli/gateway)

---

*Especificação criada em 02/02/2026 | Mission Control Team*
