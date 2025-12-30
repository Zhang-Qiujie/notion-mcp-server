# MCP Server 示例项目

这个目录包含了多个 MCP Server 的实践示例，帮助你理解如何编写自己的 MCP Server。

## 📁 文件说明

### `simple-todo-mcp-server.ts`

一个完整的、生产级别的 TODO 待办事项 MCP Server。

**特性**：
- ✅ 完整的 CRUD 操作
- ✅ 状态管理（内存存储）
- ✅ 错误处理
- ✅ 统计功能
- ✅ 详细的代码注释

**工具列表**：
1. `create_todo` - 创建待办事项
2. `list_todos` - 列出所有待办（支持筛选）
3. `get_todo` - 获取单个待办详情
4. `update_todo` - 更新待办事项
5. `complete_todo` - 标记为完成
6. `delete_todo` - 删除待办事项
7. `clear_todos` - 清空所有待办
8. `get_stats` - 获取统计信息

## 🚀 快速开始

### 1. 安装依赖

```bash
npm install @modelcontextprotocol/sdk
```

### 2. 运行服务器

```bash
# 方式 1: 使用 tsx（推荐用于开发）
npx tsx simple-todo-mcp-server.ts

# 方式 2: 编译后运行
npx tsc simple-todo-mcp-server.ts --module es2022 --moduleResolution bundler
node simple-todo-mcp-server.js
```

### 3. 配置到 Claude Desktop

在 `~/.config/Claude/claude_desktop_config.json` 或 `.cursor/mcp.json` 中添加：

```json
{
  "mcpServers": {
    "todo": {
      "command": "npx",
      "args": [
        "tsx",
        "/path/to/notion-mcp-server/examples/simple-todo-mcp-server.ts"
      ]
    }
  }
}
```

### 4. 测试

重启 Claude Desktop 或 Cursor，然后尝试：

```
你：帮我创建一个待办事项："学习 MCP Server 开发"
AI：好的，我来为你创建... [调用 create_todo]

你：列出所有待办事项
AI：让我查看... [调用 list_todos]

你：把第一个标记为完成
AI：好的... [调用 complete_todo]
```

## 📊 架构说明

```
┌─────────────────────────────────────────┐
│         Claude Desktop / Cursor          │
│                                          │
│  用户: "创建待办事项：买牛奶"              │
└────────────────┬────────────────────────┘
                 │ MCP Protocol (STDIO)
                 ↓
┌─────────────────────────────────────────┐
│      Todo MCP Server (TypeScript)        │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  Server (MCP SDK)                  │ │
│  │  - ListToolsRequestHandler         │ │
│  │  - CallToolRequestHandler          │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │  TodoStore (Business Logic)        │ │
│  │  - create()                        │ │
│  │  - list()                          │ │
│  │  - update()                        │ │
│  │  - delete()                        │ │
│  └────────────┬───────────────────────┘ │
│               │                          │
│  ┌────────────▼───────────────────────┐ │
│  │  Data Storage (In-Memory Map)      │ │
│  │  Map<string, Todo>                 │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 🔍 代码结构解析

### 1. 数据模型

```typescript
interface Todo {
  id: string              // 唯一标识
  title: string           // 标题
  description?: string    // 描述（可选）
  completed: boolean      // 完成状态
  createdAt: string       // 创建时间
  completedAt?: string    // 完成时间（可选）
}
```

### 2. 存储层 (`TodoStore`)

```typescript
class TodoStore {
  private todos: Map<string, Todo>
  
  create(title, description)    // 创建
  list(filter)                  // 列表
  get(id)                       // 获取
  update(id, updates)           // 更新
  delete(id)                    // 删除
  complete(id)                  // 标记完成
  clear()                       // 清空
  stats()                       // 统计
}
```

### 3. MCP Server 层 (`TodoMCPServer`)

```typescript
class TodoMCPServer {
  private server: Server        // MCP SDK 服务器
  private store: TodoStore      // 数据存储
  
  getTools()                    // 定义工具列表
  setupHandlers()               // 设置请求处理器
  start()                       // 启动服务器
}
```

## 💡 学习要点

### 1. 工具定义的最佳实践

```typescript
{
  name: 'create_todo',
  description: '创建一个新的待办事项',  // 清晰的描述
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '待办事项的标题（必填）',  // 每个参数都有说明
      },
      description: {
        type: 'string',
        description: '待办事项的详细描述（可选）',
      },
    },
    required: ['title'],  // 明确必填字段
  },
}
```

### 2. 错误处理

```typescript
try {
  const todo = this.store.get(args.id)
  if (!todo) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `待办事项 ID ${args.id} 不存在`,
        }),
      }],
      isError: true,  // 标记为错误
    }
  }
  // ... 正常处理
} catch (error: any) {
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: false,
        error: error.message,
      }),
    }],
    isError: true,
  }
}
```

### 3. 响应格式

统一的响应格式让 AI 更容易理解：

```typescript
// 成功响应
{
  success: true,
  message: "操作成功的消息",
  data: { ... }  // 实际数据
}

// 错误响应
{
  success: false,
  error: "错误描述"
}
```

## 🔧 扩展建议

基于这个示例，你可以尝试：

### 1. 添加持久化存储

```typescript
import fs from 'fs/promises'

class TodoStore {
  private filePath = './todos.json'
  
  async save() {
    const data = Array.from(this.todos.values())
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2))
  }
  
  async load() {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8')
      const todos = JSON.parse(content)
      this.todos = new Map(todos.map(t => [t.id, t]))
    } catch {
      // 文件不存在，使用空数据
    }
  }
}
```

### 2. 添加分类和标签

```typescript
interface Todo {
  // ... 现有字段
  category?: string
  tags?: string[]
  priority?: 'low' | 'medium' | 'high'
}

// 添加新工具
{
  name: 'search_todos',
  description: '按关键词、标签或分类搜索',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
      category: { type: 'string' }
    }
  }
}
```

### 3. 添加截止日期提醒

```typescript
interface Todo {
  // ... 现有字段
  dueDate?: string
  reminder?: string
}

// 添加工具
{
  name: 'get_overdue_todos',
  description: '获取所有过期的待办事项'
}
```

### 4. 添加用户系统

```typescript
interface Todo {
  // ... 现有字段
  userId: string
  assignedTo?: string[]
}

class TodoStore {
  listByUser(userId: string): Todo[] {
    return Array.from(this.todos.values())
      .filter(t => t.userId === userId)
  }
}
```

## 📚 相关资源

- [MCP 官方文档](https://spec.modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server)
- [更多 MCP Server 示例](https://github.com/modelcontextprotocol/servers)

## ❓ 常见问题

### Q: 为什么使用 `console.error` 而不是 `console.log`？

A: MCP Server 使用 stdio 进行通信，`stdout` 用于传输 MCP 协议消息。日志必须输出到 `stderr` 以避免干扰协议通信。

### Q: 如何调试 MCP Server？

A: 
1. 在代码中使用 `console.error()` 输出日志
2. 查看 Claude Desktop 的日志文件：
   - macOS: `~/Library/Logs/Claude/mcp*.log`
   - Windows: `%APPDATA%\Claude\logs\mcp*.log`

### Q: 可以使用其他语言编写 MCP Server 吗？

A: 可以！只要实现 MCP 协议即可。目前官方提供了 TypeScript 和 Python SDK。

### Q: 如何测试 MCP Server？

A: 
1. 单元测试：使用 vitest/jest 测试业务逻辑
2. 集成测试：使用 MCP SDK 的 Client 模拟 AI 调用
3. 手动测试：在 Claude Desktop 中实际使用

---

**祝你学习愉快！** 🎉

