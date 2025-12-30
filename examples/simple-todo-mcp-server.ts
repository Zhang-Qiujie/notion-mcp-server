/**
 * 简单的 TODO MCP Server 示例
 * 
 * 这是一个完整的、可运行的 MCP Server 示例，展示了如何：
 * 1. 创建 MCP Server
 * 2. 定义工具
 * 3. 处理状态
 * 4. 实现 CRUD 操作
 * 
 * 使用方法：
 * 1. npm install @modelcontextprotocol/sdk
 * 2. npx tsx simple-todo-mcp-server.ts
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js'

// ============================================
// 数据模型
// ============================================

interface Todo {
  id: string
  title: string
  description?: string
  completed: boolean
  createdAt: string
  completedAt?: string
}

// ============================================
// 内存数据存储
// ============================================

class TodoStore {
  private todos: Map<string, Todo> = new Map()
  private nextId: number = 1

  create(title: string, description?: string): Todo {
    const todo: Todo = {
      id: this.nextId.toString(),
      title,
      description,
      completed: false,
      createdAt: new Date().toISOString(),
    }
    this.todos.set(todo.id, todo)
    this.nextId++
    return todo
  }

  list(filter?: 'all' | 'completed' | 'pending'): Todo[] {
    const allTodos = Array.from(this.todos.values())
    
    switch (filter) {
      case 'completed':
        return allTodos.filter(t => t.completed)
      case 'pending':
        return allTodos.filter(t => !t.completed)
      default:
        return allTodos
    }
  }

  get(id: string): Todo | undefined {
    return this.todos.get(id)
  }

  update(id: string, updates: Partial<Todo>): Todo | null {
    const todo = this.todos.get(id)
    if (!todo) return null

    const updated = { ...todo, ...updates }
    this.todos.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return this.todos.delete(id)
  }

  complete(id: string): Todo | null {
    const todo = this.todos.get(id)
    if (!todo) return null

    todo.completed = true
    todo.completedAt = new Date().toISOString()
    return todo
  }

  clear(): void {
    this.todos.clear()
    this.nextId = 1
  }

  stats(): { total: number; completed: number; pending: number } {
    const allTodos = Array.from(this.todos.values())
    return {
      total: allTodos.length,
      completed: allTodos.filter(t => t.completed).length,
      pending: allTodos.filter(t => !t.completed).length,
    }
  }
}

// ============================================
// MCP Server 实现
// ============================================

class TodoMCPServer {
  private server: Server
  private store: TodoStore

  constructor() {
    this.store = new TodoStore()
    this.server = new Server(
      {
        name: 'todo-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    )

    this.setupHandlers()
  }

  private getTools(): Tool[] {
    return [
      {
        name: 'create_todo',
        description: '创建一个新的待办事项',
        inputSchema: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '待办事项的标题（必填）',
            },
            description: {
              type: 'string',
              description: '待办事项的详细描述（可选）',
            },
          },
          required: ['title'],
        },
      },
      {
        name: 'list_todos',
        description: '列出所有待办事项，可以按状态筛选',
        inputSchema: {
          type: 'object',
          properties: {
            filter: {
              type: 'string',
              enum: ['all', 'completed', 'pending'],
              description: '筛选条件：all（全部）、completed（已完成）、pending（未完成）',
              default: 'all',
            },
          },
        },
      },
      {
        name: 'get_todo',
        description: '获取指定 ID 的待办事项详情',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '待办事项的 ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'update_todo',
        description: '更新待办事项的标题或描述',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '待办事项的 ID',
            },
            title: {
              type: 'string',
              description: '新的标题（可选）',
            },
            description: {
              type: 'string',
              description: '新的描述（可选）',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'complete_todo',
        description: '将待办事项标记为已完成',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '待办事项的 ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'delete_todo',
        description: '删除指定的待办事项',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: '待办事项的 ID',
            },
          },
          required: ['id'],
        },
      },
      {
        name: 'clear_todos',
        description: '清空所有待办事项（危险操作，请谨慎使用）',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'get_stats',
        description: '获取待办事项统计信息',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ]
  }

  private setupHandlers() {
    // 处理工具列表请求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.getTools(),
      }
    })

    // 处理工具调用请求
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params

      try {
        switch (name) {
          case 'create_todo': {
            const todo = this.store.create(args.title, args.description)
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '待办事项创建成功',
                    todo,
                  }, null, 2),
                },
              ],
            }
          }

          case 'list_todos': {
            const todos = this.store.list(args.filter || 'all')
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    filter: args.filter || 'all',
                    count: todos.length,
                    todos,
                  }, null, 2),
                },
              ],
            }
          }

          case 'get_todo': {
            const todo = this.store.get(args.id)
            if (!todo) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: `待办事项 ID ${args.id} 不存在`,
                    }),
                  },
                ],
                isError: true,
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    todo,
                  }, null, 2),
                },
              ],
            }
          }

          case 'update_todo': {
            const updates: Partial<Todo> = {}
            if (args.title !== undefined) updates.title = args.title
            if (args.description !== undefined) updates.description = args.description

            const todo = this.store.update(args.id, updates)
            if (!todo) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: `待办事项 ID ${args.id} 不存在`,
                    }),
                  },
                ],
                isError: true,
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '待办事项更新成功',
                    todo,
                  }, null, 2),
                },
              ],
            }
          }

          case 'complete_todo': {
            const todo = this.store.complete(args.id)
            if (!todo) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: `待办事项 ID ${args.id} 不存在`,
                    }),
                  },
                ],
                isError: true,
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '待办事项已标记为完成',
                    todo,
                  }, null, 2),
                },
              ],
            }
          }

          case 'delete_todo': {
            const success = this.store.delete(args.id)
            if (!success) {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      success: false,
                      error: `待办事项 ID ${args.id} 不存在`,
                    }),
                  },
                ],
                isError: true,
              }
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: `待办事项 ID ${args.id} 已删除`,
                  }, null, 2),
                },
              ],
            }
          }

          case 'clear_todos': {
            this.store.clear()
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    message: '所有待办事项已清空',
                  }, null, 2),
                },
              ],
            }
          }

          case 'get_stats': {
            const stats = this.store.stats()
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    stats,
                  }, null, 2),
                },
              ],
            }
          }

          default:
            throw new Error(`未知的工具: ${name}`)
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                stack: error.stack,
              }),
            },
          ],
          isError: true,
        }
      }
    })
  }

  async start() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    
    // 在 stderr 输出日志（不会干扰 stdio 通信）
    console.error('Todo MCP Server started successfully')
    console.error('Available tools: create_todo, list_todos, get_todo, update_todo, complete_todo, delete_todo, clear_todos, get_stats')
  }
}

// ============================================
// 启动服务器
// ============================================

const server = new TodoMCPServer()
server.start().catch((error) => {
  console.error('Failed to start server:', error)
  process.exit(1)
})

