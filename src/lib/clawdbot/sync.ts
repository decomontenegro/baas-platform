/**
 * Clawdbot Sync Service
 * Synchronizes groups from Clawdbot Gateway with Dashboard database
 */

import { ClawdbotClient, getClawdbotClient } from './client';
import { clawdbotLogger } from '@/lib/logger';
import type {
  WhatsAppGroup,
  GroupConfig,
  SyncResult,
  SyncError,
  DashboardChannel,
  ChannelSyncStatus,
} from './types';

const logger = clawdbotLogger.child({ component: 'sync' });

// Placeholder for database operations - replace with actual DB client
interface DatabaseClient {
  channels: {
    findMany: (query: unknown) => Promise<DashboardChannel[]>;
    findUnique: (query: unknown) => Promise<DashboardChannel | null>;
    create: (data: unknown) => Promise<DashboardChannel>;
    update: (query: unknown) => Promise<DashboardChannel>;
    delete: (query: unknown) => Promise<void>;
    upsert: (query: unknown) => Promise<DashboardChannel>;
  };
  syncStatus: {
    findUnique: (query: unknown) => Promise<ChannelSyncStatus | null>;
    upsert: (query: unknown) => Promise<ChannelSyncStatus>;
  };
}

export interface SyncOptions {
  organizationId: string;
  dryRun?: boolean;
  forceUpdate?: boolean;
  onProgress?: (progress: SyncProgress) => void;
}

export interface SyncProgress {
  stage: 'fetching' | 'comparing' | 'updating' | 'complete';
  current: number;
  total: number;
  message: string;
}

export class ClawdbotSyncService {
  private client: ClawdbotClient;
  private db: DatabaseClient;

  constructor(db: DatabaseClient, client?: ClawdbotClient) {
    this.db = db;
    this.client = client || getClawdbotClient();
  }

  /**
   * Perform a full sync of groups from Clawdbot to the database
   */
  async syncGroups(options: SyncOptions): Promise<SyncResult> {
    const { organizationId, dryRun = false, forceUpdate = false, onProgress } = options;

    logger.info({ 
      organizationId, 
      dryRun, 
      forceUpdate,
    }, 'Starting group sync');

    const result: SyncResult = {
      success: true,
      timestamp: Date.now(),
      added: [],
      updated: [],
      removed: [],
      errors: [],
    };

    try {
      // Update sync status
      if (!dryRun) {
        await this.updateSyncStatus(organizationId, { syncInProgress: true });
      }

      // Stage 1: Fetch groups from Clawdbot
      onProgress?.({ stage: 'fetching', current: 0, total: 1, message: 'Fetching groups from Clawdbot...' });
      
      if (!this.client.isConnected()) {
        logger.debug({ organizationId }, 'Client not connected, connecting...');
        await this.client.connect();
      }
      
      const clawdbotGroups = await this.client.getGroups();
      logger.debug({ 
        organizationId, 
        groupCount: clawdbotGroups.length,
      }, 'Fetched groups from Clawdbot');
      
      // Stage 2: Get existing channels from database
      onProgress?.({ stage: 'comparing', current: 0, total: clawdbotGroups.length, message: 'Comparing with database...' });
      
      const existingChannels = await this.db.channels.findMany({
        where: {
          organizationId,
          type: 'whatsapp_group',
        },
      });

      const existingByGroupId = new Map(
        existingChannels.map(ch => [ch.clawdbotGroupId, ch])
      );

      const clawdbotGroupIds = new Set(clawdbotGroups.map(g => g.id));

      // Stage 3: Process updates
      onProgress?.({ stage: 'updating', current: 0, total: clawdbotGroups.length, message: 'Syncing changes...' });

      let processed = 0;

      // Add or update groups
      for (const group of clawdbotGroups) {
        try {
          const existing = existingByGroupId.get(group.id);
          
          if (!existing) {
            // New group - add to database
            logger.debug({ 
              organizationId, 
              groupId: group.id, 
              groupName: group.name,
            }, 'Adding new group');
            
            if (!dryRun) {
              const config = await this.client.getGroupConfig(group.id);
              await this.db.channels.create({
                data: {
                  clawdbotGroupId: group.id,
                  name: group.name,
                  organizationId,
                  type: 'whatsapp_group',
                  status: config?.enabled ? 'active' : 'inactive',
                  config: config || this.getDefaultConfig(),
                },
              });
            }
            result.added.push(group.id);
          } else if (forceUpdate || this.needsUpdate(existing, group)) {
            // Existing group - update if changed
            logger.debug({ 
              organizationId, 
              groupId: group.id, 
              forceUpdate,
            }, 'Updating existing group');
            
            if (!dryRun) {
              const config = await this.client.getGroupConfig(group.id);
              await this.db.channels.update({
                where: { id: existing.id },
                data: {
                  name: group.name,
                  config: config || existing.config,
                  updatedAt: new Date(),
                },
              });
            }
            result.updated.push(group.id);
          }

          processed++;
          onProgress?.({
            stage: 'updating',
            current: processed,
            total: clawdbotGroups.length,
            message: `Processed ${processed}/${clawdbotGroups.length} groups`,
          });
        } catch (error) {
          logger.error({ 
            err: error, 
            organizationId, 
            groupId: group.id,
          }, 'Error processing group');
          
          result.errors.push({
            groupId: group.id,
            error: error instanceof Error ? error.message : 'Unknown error',
            recoverable: true,
          });
        }
      }

      // Mark removed groups
      for (const existing of existingChannels) {
        if (!clawdbotGroupIds.has(existing.clawdbotGroupId)) {
          logger.debug({ 
            organizationId, 
            groupId: existing.clawdbotGroupId,
          }, 'Marking group as removed');
          
          if (!dryRun) {
            await this.db.channels.update({
              where: { id: existing.id },
              data: {
                status: 'inactive',
                updatedAt: new Date(),
              },
            });
          }
          result.removed.push(existing.clawdbotGroupId);
        }
      }

      // Complete
      onProgress?.({
        stage: 'complete',
        current: clawdbotGroups.length,
        total: clawdbotGroups.length,
        message: `Sync complete: ${result.added.length} added, ${result.updated.length} updated, ${result.removed.length} removed`,
      });

      result.success = result.errors.length === 0;

      // Update sync status
      if (!dryRun) {
        await this.updateSyncStatus(organizationId, {
          syncInProgress: false,
          lastSyncAt: Date.now(),
          lastSyncResult: result,
          totalGroups: clawdbotGroups.length,
          activeGroups: clawdbotGroups.length - result.removed.length,
        });
      }

      logger.info({ 
        organizationId,
        added: result.added.length,
        updated: result.updated.length,
        removed: result.removed.length,
        errors: result.errors.length,
        dryRun,
      }, 'Group sync completed');

    } catch (error) {
      logger.error({ 
        err: error, 
        organizationId,
      }, 'Group sync failed');

      result.success = false;
      result.errors.push({
        groupId: '*',
        error: error instanceof Error ? error.message : 'Unknown sync error',
        recoverable: false,
      });

      if (!dryRun) {
        await this.updateSyncStatus(organizationId, { syncInProgress: false });
      }
    }

    return result;
  }

  /**
   * Sync a single group's configuration from Clawdbot
   */
  async syncSingleGroup(organizationId: string, groupId: string): Promise<DashboardChannel | null> {
    logger.debug({ organizationId, groupId }, 'Syncing single group');
    
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    const config = await this.client.getGroupConfig(groupId);
    if (!config) {
      logger.warn({ organizationId, groupId }, 'Group config not found');
      return null;
    }

    const existing = await this.db.channels.findUnique({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: groupId,
        },
      },
    });

    if (existing) {
      logger.debug({ organizationId, groupId }, 'Updating existing group');
      return this.db.channels.update({
        where: { id: existing.id },
        data: {
          config,
          status: config.enabled ? 'active' : 'inactive',
          updatedAt: new Date(),
        },
      });
    } else {
      // Fetch group info
      const groups = await this.client.getGroups();
      const group = groups.find(g => g.id === groupId);

      logger.debug({ organizationId, groupId }, 'Creating new group');
      return this.db.channels.create({
        data: {
          clawdbotGroupId: groupId,
          name: group?.name || groupId,
          organizationId,
          type: 'whatsapp_group',
          status: config.enabled ? 'active' : 'inactive',
          config,
        },
      });
    }
  }

  /**
   * Push configuration from dashboard to Clawdbot
   */
  async pushConfigToClawdbot(channel: DashboardChannel): Promise<void> {
    logger.info({ 
      channelId: channel.id, 
      groupId: channel.clawdbotGroupId,
    }, 'Pushing config to Clawdbot');
    
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    await this.client.updateGroupConfig(channel.clawdbotGroupId, channel.config);

    // Update local record
    await this.db.channels.update({
      where: { id: channel.id },
      data: { updatedAt: new Date() },
    });

    logger.info({ 
      channelId: channel.id, 
      groupId: channel.clawdbotGroupId,
    }, 'Config pushed to Clawdbot successfully');
  }

  /**
   * Detect new groups that aren't in the database yet
   */
  async detectNewGroups(organizationId: string): Promise<WhatsAppGroup[]> {
    logger.debug({ organizationId }, 'Detecting new groups');
    
    if (!this.client.isConnected()) {
      await this.client.connect();
    }

    const clawdbotGroups = await this.client.getGroups();
    const existingChannels = await this.db.channels.findMany({
      where: {
        organizationId,
        type: 'whatsapp_group',
      },
    });

    const existingGroupIds = new Set(existingChannels.map(ch => ch.clawdbotGroupId));
    const newGroups = clawdbotGroups.filter(g => !existingGroupIds.has(g.id));

    logger.debug({ 
      organizationId, 
      newGroupCount: newGroups.length,
    }, 'Detected new groups');

    return newGroups;
  }

  /**
   * Get sync status for an organization
   */
  async getSyncStatus(organizationId: string): Promise<ChannelSyncStatus | null> {
    return this.db.syncStatus.findUnique({
      where: { organizationId },
    });
  }

  // ============================================
  // Private Methods
  // ============================================

  private needsUpdate(existing: DashboardChannel, group: WhatsAppGroup): boolean {
    return existing.name !== group.name;
  }

  private getDefaultConfig(): GroupConfig {
    return {
      requireMention: true,
      enabled: true,
      historyLimit: 50,
      personality: {
        formality: 50,
        verbosity: 50,
        creativity: 50,
        empathy: 50,
        humor: 50,
      },
      features: {
        imageAnalysis: true,
        voiceMessages: false,
        codeExecution: false,
        webSearch: true,
      },
    };
  }

  private async updateSyncStatus(
    organizationId: string,
    data: Partial<ChannelSyncStatus>
  ): Promise<void> {
    await this.db.syncStatus.upsert({
      where: { organizationId },
      create: {
        organizationId,
        lastSyncAt: 0,
        syncInProgress: false,
        totalGroups: 0,
        activeGroups: 0,
        ...data,
      },
      update: data,
    });
  }
}

// ============================================
// Webhook Handler for Real-time Sync
// ============================================

const webhookLogger = clawdbotLogger.child({ component: 'webhook-handler' });

export class ClawdbotWebhookHandler {
  private db: DatabaseClient;
  private onNewGroup?: (group: WhatsAppGroup, organizationId: string) => void;

  constructor(
    db: DatabaseClient,
    options?: {
      onNewGroup?: (group: WhatsAppGroup, organizationId: string) => void;
    }
  ) {
    this.db = db;
    this.onNewGroup = options?.onNewGroup;
  }

  /**
   * Handle incoming webhook events from Clawdbot
   */
  async handleEvent(event: unknown, organizationId: string): Promise<void> {
    const typedEvent = event as { type: string; [key: string]: unknown };

    webhookLogger.debug({ 
      eventType: typedEvent.type, 
      organizationId,
    }, 'Handling webhook event');

    switch (typedEvent.type) {
      case 'group.joined':
        await this.handleGroupJoined(typedEvent, organizationId);
        break;

      case 'group.left':
        await this.handleGroupLeft(typedEvent, organizationId);
        break;

      case 'message.received':
        await this.handleMessageReceived(typedEvent, organizationId);
        break;

      case 'status.change':
        await this.handleStatusChange(typedEvent, organizationId);
        break;

      default:
        webhookLogger.debug({ eventType: typedEvent.type }, 'Unhandled webhook event type');
    }
  }

  private async handleGroupJoined(event: Record<string, unknown>, organizationId: string): Promise<void> {
    const group = event.group as WhatsAppGroup;
    
    webhookLogger.info({ 
      groupId: group.id, 
      groupName: group.name, 
      organizationId,
    }, 'Group joined event received');

    // Check if group already exists
    const existing = await this.db.channels.findUnique({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: group.id,
        },
      },
    });

    if (!existing) {
      // Create new channel
      await this.db.channels.create({
        data: {
          clawdbotGroupId: group.id,
          name: group.name,
          organizationId,
          type: 'whatsapp_group',
          status: 'pending', // Needs configuration
          config: {
            requireMention: true,
            enabled: false, // Disabled by default until configured
            historyLimit: 50,
          },
        },
      });

      webhookLogger.info({ 
        groupId: group.id, 
        groupName: group.name, 
        organizationId,
      }, 'New group created in database');

      // Notify about new group
      this.onNewGroup?.(group, organizationId);
    }
  }

  private async handleGroupLeft(event: Record<string, unknown>, organizationId: string): Promise<void> {
    const groupId = event.groupId as string;

    webhookLogger.info({ 
      groupId, 
      organizationId,
    }, 'Group left event received');

    await this.db.channels.update({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: groupId,
        },
      },
      data: {
        status: 'inactive',
        updatedAt: new Date(),
      },
    });
  }

  private async handleMessageReceived(event: Record<string, unknown>, organizationId: string): Promise<void> {
    const message = event.message as { groupId?: string };
    if (!message.groupId) return;

    // Update last message timestamp
    await this.db.channels.update({
      where: {
        organizationId_clawdbotGroupId: {
          organizationId,
          clawdbotGroupId: message.groupId,
        },
      },
      data: {
        lastMessageAt: new Date(),
      },
    });
  }

  private async handleStatusChange(event: Record<string, unknown>, organizationId: string): Promise<void> {
    const status = event.status as string;
    
    webhookLogger.info({ 
      status, 
      organizationId,
    }, 'Status change event received');
  }
}
