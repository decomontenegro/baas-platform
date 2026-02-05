'use client';
// Force dynamic rendering
export const dynamic = 'force-dynamic'

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Wifi,
  WifiOff,
  RefreshCw,
  MessageSquare,
  Users,
  Activity,
  CheckCircle2,
  XCircle,
  Loader2,
  Power,
  PowerOff,
  Settings,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ClawdbotStatus {
  connection: {
    connected: boolean;
    authenticated: boolean;
    protocol?: number;
    lastError?: string;
    reconnectAttempts: number;
  };
  gateway?: {
    ok: boolean;
    version: string;
    uptime: number;
    linkedChannel?: string;
  };
  channels?: {
    total: number;
    active: number;
    whatsapp?: {
      linked: boolean;
      accountId?: string;
      displayName?: string;
    };
  };
  lastSync?: {
    at: string | null;
    groupCount: number;
  };
}

interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string;
  _local?: {
    isActive: boolean;
    settings?: Record<string, unknown>;
  };
}

export default function ConnectPage() {
  const [status, setStatus] = React.useState<ClawdbotStatus | null>(null);
  const [groups, setGroups] = React.useState<WhatsAppGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [connecting, setConnecting] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [activatingGroup, setActivatingGroup] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch status on mount
  React.useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  // Fetch groups when connected
  React.useEffect(() => {
    if (status?.connection.connected && status?.connection.authenticated) {
      fetchGroups();
    }
  }, [status?.connection.connected, status?.connection.authenticated]);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/clawdbot/status');
      const data = await res.json();
      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError(data.error?.message || 'Failed to fetch status');
      }
    } catch (err) {
      setError('Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }

  async function fetchGroups() {
    try {
      const res = await fetch('/api/clawdbot/groups?includeLocal=true');
      const data = await res.json();
      if (data.success) {
        setGroups(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    }
  }

  async function handleConnect() {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch('/api/clawdbot/connect', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error?.message || 'Connection failed');
      }
    } catch (err) {
      setError('Failed to connect');
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    setConnecting(true);
    try {
      const res = await fetch('/api/clawdbot/connect', { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
        setGroups([]);
      }
    } catch (err) {
      setError('Failed to disconnect');
    } finally {
      setConnecting(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch('/api/clawdbot/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forceUpdate: true }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchGroups();
        await fetchStatus();
      }
    } catch (err) {
      setError('Sync failed');
    } finally {
      setSyncing(false);
    }
  }

  async function handleActivateGroup(groupId: string, activate: boolean) {
    setActivatingGroup(groupId);
    try {
      const res = await fetch(`/api/clawdbot/groups/${encodeURIComponent(groupId)}/activate`, {
        method: activate ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requireMention: true,
          features: {
            imageAnalysis: true,
            webSearch: true,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchGroups();
      } else {
        setError(data.error?.message || 'Activation failed');
      }
    } catch (err) {
      setError('Failed to update group');
    } finally {
      setActivatingGroup(null);
    }
  }

  const isConnected = status?.connection.connected && status?.connection.authenticated;
  const whatsappLinked = status?.channels?.whatsapp?.linked;

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clawdbot Connection</h1>
          <p className="text-muted-foreground">
            Connect your dashboard to Clawdbot Gateway and manage WhatsApp groups
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
          >
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <XCircle className="h-4 w-4" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        </div>
      )}

      {/* Connection Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Gateway Connection */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gateway</CardTitle>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.gateway?.version
                ? `Version ${status.gateway.version}`
                : status?.connection.lastError || 'Not connected'}
            </p>
          </CardContent>
        </Card>

        {/* WhatsApp Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">WhatsApp</CardTitle>
            <MessageSquare
              className={cn('h-4 w-4', whatsappLinked ? 'text-green-500' : 'text-yellow-500')}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {whatsappLinked ? 'Linked' : 'Not Linked'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.channels?.whatsapp?.displayName || 'Connect WhatsApp in Clawdbot'}
            </p>
          </CardContent>
        </Card>

        {/* Groups Count */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{status?.channels?.total || groups.length}</div>
            <p className="text-xs text-muted-foreground">
              {status?.channels?.active || 0} active
            </p>
          </CardContent>
        </Card>

        {/* Last Sync */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {status?.lastSync?.at
                ? new Date(status.lastSync.at).toLocaleTimeString()
                : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">
              {status?.lastSync?.groupCount || 0} groups synced
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Connection Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Connection Control</CardTitle>
          <CardDescription>
            Manage your connection to the Clawdbot Gateway
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4">
          {isConnected ? (
            <>
              <Button
                variant="destructive"
                onClick={handleDisconnect}
                disabled={connecting}
              >
                {connecting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PowerOff className="mr-2 h-4 w-4" />
                )}
                Disconnect
              </Button>
              <Button
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Sync Groups
              </Button>
            </>
          ) : (
            <Button onClick={handleConnect} disabled={connecting}>
              {connecting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Power className="mr-2 h-4 w-4" />
              )}
              Connect to Gateway
            </Button>
          )}
        </CardContent>
      </Card>

      {/* WhatsApp QR Code Info (when not linked) */}
      {isConnected && !whatsappLinked && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <MessageSquare className="h-5 w-5" />
              WhatsApp Not Connected
            </CardTitle>
            <CardDescription className="text-yellow-700 dark:text-yellow-300">
              You need to link WhatsApp in the Clawdbot Gateway to manage groups.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-yellow-700 dark:text-yellow-300">
              Open the Clawdbot Gateway CLI and scan the QR code with WhatsApp on your phone.
              The connection status will update automatically once linked.
            </p>
            <Button variant="outline" asChild>
              <a href="https://github.com/clawdbot/clawdbot" target="_blank" rel="noopener">
                <ExternalLink className="mr-2 h-4 w-4" />
                Clawdbot Documentation
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Groups List */}
      {isConnected && whatsappLinked && (
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Groups</CardTitle>
            <CardDescription>
              Enable or disable the bot for each group. Enabled groups will receive AI responses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-4 h-12 w-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No groups found</h3>
                <p className="text-sm text-muted-foreground">
                  Add the bot to WhatsApp groups to see them here
                </p>
                <Button variant="outline" className="mt-4" onClick={handleSync}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Groups
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const isActive = group._local?.isActive;
                  const isActivating = activatingGroup === group.id;

                  return (
                    <div
                      key={group.id}
                      className={cn(
                        'flex items-center justify-between rounded-lg border p-4',
                        isActive && 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950'
                      )}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className={cn(
                            'flex h-10 w-10 items-center justify-center rounded-full',
                            isActive
                              ? 'bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-400'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          <Users className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{group.name}</h4>
                            <Badge variant={isActive ? 'default' : 'secondary'}>
                              {isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {group.id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          asChild
                        >
                          <a href={`/channels/${encodeURIComponent(group.id)}`}>
                            <Settings className="h-4 w-4" />
                          </a>
                        </Button>
                        <Button
                          variant={isActive ? 'destructive' : 'default'}
                          size="sm"
                          onClick={() => handleActivateGroup(group.id, !isActive)}
                          disabled={isActivating}
                        >
                          {isActivating ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : isActive ? (
                            <XCircle className="mr-2 h-4 w-4" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          {isActive ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Protocol Info */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Connection Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Protocol</dt>
                <dd className="font-medium">{status.connection.protocol || 'N/A'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Reconnect Attempts</dt>
                <dd className="font-medium">{status.connection.reconnectAttempts}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gateway Uptime</dt>
                <dd className="font-medium">
                  {status.gateway?.uptime
                    ? `${Math.floor(status.gateway.uptime / 3600)}h ${Math.floor((status.gateway.uptime % 3600) / 60)}m`
                    : 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Gateway Status</dt>
                <dd className="font-medium">
                  {status.gateway?.ok ? (
                    <span className="text-green-600">Healthy</span>
                  ) : (
                    <span className="text-red-600">Unhealthy</span>
                  )}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
