// Notion Integration
import { BaseStorageIntegration } from './base'
import type { StorageDocument } from './types'
import type { IntegrationType } from '@prisma/client'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

interface NotionPage {
  id: string
  object: 'page'
  parent: {
    type: string
    page_id?: string
    database_id?: string
    workspace?: boolean
  }
  properties: Record<string, any>
  url: string
  created_time: string
  last_edited_time: string
}

interface NotionBlock {
  id: string
  type: string
  [key: string]: any
}

export class NotionIntegration extends BaseStorageIntegration {
  get type(): IntegrationType {
    return 'STORAGE_NOTION'
  }

  protected async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
      'Authorization': `Bearer ${this.credentials.accessToken}`,
      ...options.headers as Record<string, string>,
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Notion API error: ${response.status} - ${error}`)
    }

    return response.json()
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request(`${NOTION_API}/users/me`)
      await this.log('TEST_CONNECTION', 'SUCCESS')
      return true
    } catch (error) {
      await this.log('TEST_CONNECTION', 'FAILED', null, (error as Error).message)
      return false
    }
  }

  async createDocument(document: StorageDocument): Promise<string> {
    const startTime = Date.now()
    try {
      // Default parent is the workspace, but can be specified
      const parentId = document.parentId || this.config.defaultPageId as string

      const pageData: any = {
        parent: parentId
          ? { page_id: parentId }
          : { type: 'workspace', workspace: true },
        properties: {
          title: {
            title: [
              {
                text: {
                  content: document.name,
                },
              },
            ],
          },
        },
        children: this.convertContentToBlocks(document.content),
      }

      const response = await this.request<NotionPage>(
        `${NOTION_API}/pages`,
        {
          method: 'POST',
          body: JSON.stringify(pageData),
        }
      )

      await this.log('CREATE_DOCUMENT', 'SUCCESS', { pageId: response.id }, undefined, Date.now() - startTime)
      return response.id
    } catch (error) {
      await this.log('CREATE_DOCUMENT', 'FAILED', document, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async updateDocument(id: string, content: string): Promise<void> {
    const startTime = Date.now()
    try {
      // First, get existing blocks to delete them
      const existingBlocks = await this.request<{ results: NotionBlock[] }>(
        `${NOTION_API}/blocks/${id}/children?page_size=100`
      )

      // Delete existing blocks
      for (const block of existingBlocks.results) {
        await this.request(
          `${NOTION_API}/blocks/${block.id}`,
          { method: 'DELETE' }
        )
      }

      // Append new content
      await this.request(
        `${NOTION_API}/blocks/${id}/children`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            children: this.convertContentToBlocks(content),
          }),
        }
      )

      await this.log('CREATE_DOCUMENT', 'SUCCESS', { pageId: id, action: 'update' }, undefined, Date.now() - startTime)
    } catch (error) {
      await this.log('CREATE_DOCUMENT', 'FAILED', { id, content }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  async getDocument(id: string): Promise<StorageDocument | null> {
    try {
      const page = await this.request<NotionPage>(`${NOTION_API}/pages/${id}`)
      
      // Get page content
      const blocks = await this.request<{ results: NotionBlock[] }>(
        `${NOTION_API}/blocks/${id}/children?page_size=100`
      )

      const title = this.extractTitle(page.properties)
      const content = this.blocksToMarkdown(blocks.results)

      return {
        id: page.id,
        name: title,
        content,
        url: page.url,
      }
    } catch (error) {
      if ((error as Error).message.includes('404') || (error as Error).message.includes('Could not find')) {
        return null
      }
      throw error
    }
  }

  async listDocuments(parentId?: string): Promise<StorageDocument[]> {
    const searchParams: any = {
      filter: {
        property: 'object',
        value: 'page',
      },
      page_size: 100,
    }

    const response = await this.request<{ results: NotionPage[] }>(
      `${NOTION_API}/search`,
      {
        method: 'POST',
        body: JSON.stringify(searchParams),
      }
    )

    return response.results.map(page => ({
      id: page.id,
      name: this.extractTitle(page.properties),
      content: '',
      url: page.url,
    }))
  }

  async uploadFile(file: Buffer, name: string, mimeType: string): Promise<string> {
    // Notion doesn't support direct file uploads via API
    // Files must be hosted externally and linked
    throw new Error('Direct file upload not supported by Notion API. Use external URL instead.')
  }

  // Create a database for structured data (like conversation logs)
  async createDatabase(title: string, parentPageId: string, properties: Record<string, any>): Promise<string> {
    const startTime = Date.now()
    try {
      const response = await this.request<{ id: string }>(
        `${NOTION_API}/databases`,
        {
          method: 'POST',
          body: JSON.stringify({
            parent: { page_id: parentPageId },
            title: [{ text: { content: title } }],
            properties,
          }),
        }
      )

      await this.log('CREATE_DOCUMENT', 'SUCCESS', { databaseId: response.id }, undefined, Date.now() - startTime)
      return response.id
    } catch (error) {
      await this.log('CREATE_DOCUMENT', 'FAILED', { title, parentPageId }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  // Add a row to a database
  async addDatabaseRow(databaseId: string, properties: Record<string, any>): Promise<string> {
    const startTime = Date.now()
    try {
      const response = await this.request<{ id: string }>(
        `${NOTION_API}/pages`,
        {
          method: 'POST',
          body: JSON.stringify({
            parent: { database_id: databaseId },
            properties,
          }),
        }
      )

      await this.log('CREATE_DOCUMENT', 'SUCCESS', { rowId: response.id, databaseId }, undefined, Date.now() - startTime)
      return response.id
    } catch (error) {
      await this.log('CREATE_DOCUMENT', 'FAILED', { databaseId, properties }, (error as Error).message, Date.now() - startTime)
      throw error
    }
  }

  // Save conversation to Notion
  async saveConversation(conversationData: {
    title: string
    contactName: string
    contactPhone?: string
    messages: { role: string; content: string; timestamp: Date }[]
    metadata?: Record<string, any>
  }): Promise<string> {
    const content = [
      `## Conversa com ${conversationData.contactName}`,
      '',
      `**Data:** ${new Date().toLocaleString('pt-BR')}`,
      conversationData.contactPhone ? `**Telefone:** ${conversationData.contactPhone}` : '',
      '',
      '---',
      '',
      '## Mensagens',
      '',
      ...conversationData.messages.map(msg => 
        `**${msg.role === 'user' ? conversationData.contactName : 'Bot'}** (${msg.timestamp.toLocaleTimeString('pt-BR')}):\n${msg.content}\n`
      ),
    ].filter(Boolean).join('\n')

    return this.createDocument({
      name: conversationData.title,
      content,
      parentId: this.config.conversationsPageId as string,
    })
  }

  private extractTitle(properties: Record<string, any>): string {
    const titleProp = Object.values(properties).find(
      (p: any) => p.type === 'title'
    )
    if (titleProp?.title?.[0]?.text?.content) {
      return titleProp.title[0].text.content
    }
    return 'Untitled'
  }

  private convertContentToBlocks(content: string): NotionBlock[] {
    const lines = content.split('\n')
    const blocks: NotionBlock[] = []

    for (const line of lines) {
      if (line.startsWith('# ')) {
        blocks.push({
          id: '',
          type: 'heading_1',
          heading_1: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        })
      } else if (line.startsWith('## ')) {
        blocks.push({
          id: '',
          type: 'heading_2',
          heading_2: {
            rich_text: [{ type: 'text', text: { content: line.slice(3) } }],
          },
        })
      } else if (line.startsWith('### ')) {
        blocks.push({
          id: '',
          type: 'heading_3',
          heading_3: {
            rich_text: [{ type: 'text', text: { content: line.slice(4) } }],
          },
        })
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        blocks.push({
          id: '',
          type: 'bulleted_list_item',
          bulleted_list_item: {
            rich_text: [{ type: 'text', text: { content: line.slice(2) } }],
          },
        })
      } else if (line.match(/^\d+\. /)) {
        blocks.push({
          id: '',
          type: 'numbered_list_item',
          numbered_list_item: {
            rich_text: [{ type: 'text', text: { content: line.replace(/^\d+\. /, '') } }],
          },
        })
      } else if (line.startsWith('---')) {
        blocks.push({
          id: '',
          type: 'divider',
          divider: {},
        })
      } else if (line.trim()) {
        blocks.push({
          id: '',
          type: 'paragraph',
          paragraph: {
            rich_text: this.parseRichText(line),
          },
        })
      }
    }

    return blocks
  }

  private parseRichText(text: string): any[] {
    // Simple bold/italic parsing
    const parts: any[] = []
    let remaining = text
    
    while (remaining.length > 0) {
      // Check for bold **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      if (boldMatch && boldMatch.index === 0) {
        parts.push({
          type: 'text',
          text: { content: boldMatch[1] },
          annotations: { bold: true },
        })
        remaining = remaining.slice(boldMatch[0].length)
        continue
      }

      // Check for italic *text* or _text_
      const italicMatch = remaining.match(/(?:\*|_)(.+?)(?:\*|_)/)
      if (italicMatch && italicMatch.index === 0) {
        parts.push({
          type: 'text',
          text: { content: italicMatch[1] },
          annotations: { italic: true },
        })
        remaining = remaining.slice(italicMatch[0].length)
        continue
      }

      // Plain text until next special char or end
      const nextSpecial = remaining.search(/[\*_]/)
      if (nextSpecial === -1) {
        parts.push({
          type: 'text',
          text: { content: remaining },
        })
        break
      } else if (nextSpecial > 0) {
        parts.push({
          type: 'text',
          text: { content: remaining.slice(0, nextSpecial) },
        })
        remaining = remaining.slice(nextSpecial)
      } else {
        // Special char not matching pattern, treat as plain
        parts.push({
          type: 'text',
          text: { content: remaining[0] },
        })
        remaining = remaining.slice(1)
      }
    }

    return parts.length > 0 ? parts : [{ type: 'text', text: { content: text } }]
  }

  private blocksToMarkdown(blocks: NotionBlock[]): string {
    return blocks.map(block => {
      const richTextToString = (richText: any[]) => 
        richText?.map((t: any) => t.text?.content || '').join('') || ''

      switch (block.type) {
        case 'heading_1':
          return `# ${richTextToString(block.heading_1.rich_text)}`
        case 'heading_2':
          return `## ${richTextToString(block.heading_2.rich_text)}`
        case 'heading_3':
          return `### ${richTextToString(block.heading_3.rich_text)}`
        case 'paragraph':
          return richTextToString(block.paragraph.rich_text)
        case 'bulleted_list_item':
          return `- ${richTextToString(block.bulleted_list_item.rich_text)}`
        case 'numbered_list_item':
          return `1. ${richTextToString(block.numbered_list_item.rich_text)}`
        case 'divider':
          return '---'
        default:
          return ''
      }
    }).join('\n')
  }
}

// OAuth helpers for Notion
export function getNotionAuthUrl(state: string, redirectUri: string): string {
  const clientId = process.env.NOTION_CLIENT_ID
  
  const url = new URL('https://api.notion.com/v1/oauth/authorize')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('owner', 'user')
  url.searchParams.set('state', state)
  
  return url.toString()
}

export async function exchangeNotionCode(code: string, redirectUri: string): Promise<{
  accessToken: string
  workspaceId: string
  workspaceName: string
  botId: string
}> {
  const clientId = process.env.NOTION_CLIENT_ID
  const clientSecret = process.env.NOTION_CLIENT_SECRET

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const response = await fetch('https://api.notion.com/v1/oauth/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`OAuth exchange failed: ${error}`)
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    workspaceId: data.workspace_id,
    workspaceName: data.workspace_name,
    botId: data.bot_id,
  }
}
