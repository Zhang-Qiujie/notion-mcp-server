# MCP Server 快速参考手册

> 一页纸快速查阅 MCP Server 开发的核心概念和代码片段

## 📋 核心概念速查

### MCP 三要素

| 组件 | 作用 | 实现 |
|------|------|------|
| **Server** | 处理请求 | `@modelcontextprotocol/sdk` |
| **Transport** | 通信层 | STDIO / HTTP |
| **Tools** | 功能实现 | 你的业务逻辑 |

### MCP 协议消息

| 消息类型 | 方向 | 用途 |
|---------|------|------|
| `tools/list` | AI → Server | 获取工具列表 |
| `tools/call` | AI → Server | 调用工具 |
| `resources/list` | AI → Server | 获取资源列表 |
| `prompts/list` | AI → Server | 获取提示词列表 |

## 🚀 最小可用 MCP Server

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

// 1. 创建服务器
const server = new Server(
  { name: 'my-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 2. 定义工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: 'hello',
    description: '打招呼',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '名字' }
      },
      required: ['name']
    }
  }]
}))

// 3. 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  
  if (name === 'hello') {
    return {
      content: [{ 
        type: 'text', 
        text: `Hello, ${args.name}!` 
      }]
    }
  }
  
  throw new Error(`Unknown tool: ${name}`)
})

// 4. 启动
const transport = new StdioServerTransport()
await server.connect(transport)
```

## 📦 常用代码片段

### 1. 工具定义模板

```typescript
const tool = {
  name: 'tool_name',              // 工具名称（必填）
  description: '工具描述',         // 清晰的描述（必填）
  inputSchema: {                  // JSON Schema（必填）
    type: 'object',
    properties: {
      param1: {
        type: 'string',
        description: '参数说明',
        enum: ['value1', 'value2'],  // 可选：限制值
        default: 'value1'            // 可选：默认值
      },
      param2: {
        type: 'number',
        minimum: 0,                  // 可选：数值范围
        maximum: 100
      },
      param3: {
        type: 'array',
        items: { type: 'string' }    // 数组元素类型
      }
    },
    required: ['param1']             // 必填参数
  }
}
```

### 2. 错误处理模板

```typescript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // 业务逻辑
    const result = await doSomething(request.params.arguments)
    
    // 成功响应
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, data: result })
      }]
    }
  } catch (error: any) {
    // 错误响应
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          code: error.code
        })
      }],
      isError: true
    }
  }
})
```

### 3. HTTP 传输模式

```typescript
import express from 'express'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

const app = express()
app.use(express.json())

// Bearer Token 认证
const authToken = process.env.AUTH_TOKEN
app.use('/mcp', (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1]
  if (token !== authToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
})

// MCP 端点
app.post('/mcp', async (req, res) => {
  const transport = new StreamableHTTPServerTransport({ ... })
  const server = new Server({ ... }, { ... })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

app.listen(3000)
```

### 4. 环境变量配置

```typescript
// 读取配置
const config = {
  apiKey: process.env.API_KEY || '',
  baseUrl: process.env.BASE_URL || 'https://api.example.com',
  timeout: parseInt(process.env.TIMEOUT || '30000', 10)
}

// 验证配置
if (!config.apiKey) {
  console.error('Error: API_KEY environment variable is required')
  process.exit(1)
}
```

### 5. 文件上传处理

```typescript
import FormData from 'form-data'
import fs from 'fs'

async function uploadFile(filePath: string) {
  const formData = new FormData()
  formData.append('file', fs.createReadStream(filePath))
  
  const response = await axios.post('/upload', formData, {
    headers: formData.getHeaders()
  })
  
  return response.data
}
```

### 6. 状态管理（内存）

```typescript
class DataStore<T> {
  private data: Map<string, T> = new Map()
  private nextId = 1

  create(item: Omit<T, 'id'>): T & { id: string } {
    const id = (this.nextId++).toString()
    const newItem = { ...item, id } as T & { id: string }
    this.data.set(id, newItem)
    return newItem
  }

  get(id: string): T | undefined {
    return this.data.get(id)
  }

  list(): T[] {
    return Array.from(this.data.values())
  }

  update(id: string, updates: Partial<T>): T | null {
    const item = this.data.get(id)
    if (!item) return null
    const updated = { ...item, ...updates }
    this.data.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return this.data.delete(id)
  }
}
```

## 🔧 配置文件模板

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "my-server": {
      "command": "node",
      "args": ["path/to/server.js"],
      "env": {
        "API_KEY": "your-api-key",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

### 使用 npx

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "tsx", "path/to/server.ts"],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

### 使用 Docker

```json
{
  "mcpServers": {
    "my-server": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e", "API_KEY",
        "my-server-image"
      ],
      "env": {
        "API_KEY": "your-api-key"
      }
    }
  }
}
```

## 📊 JSON Schema 速查

### 基本类型

```typescript
// 字符串
{ type: 'string' }
{ type: 'string', minLength: 1, maxLength: 100 }
{ type: 'string', pattern: '^[a-z]+$' }
{ type: 'string', format: 'email' }  // email, uri, date-time, etc.

// 数字
{ type: 'number' }
{ type: 'integer', minimum: 0, maximum: 100 }

// 布尔值
{ type: 'boolean' }

// 数组
{ type: 'array', items: { type: 'string' } }
{ type: 'array', minItems: 1, maxItems: 10 }

// 对象
{
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number' }
  },
  required: ['name']
}

// 枚举
{ type: 'string', enum: ['value1', 'value2', 'value3'] }

// 可选类型（联合类型）
{ anyOf: [{ type: 'string' }, { type: 'null' }] }
{ oneOf: [{ type: 'string' }, { type: 'number' }] }
```

## 🐛 调试技巧

### 1. 日志输出

```typescript
// ✅ 使用 stderr（不干扰 MCP 协议）
console.error('Debug info:', data)

// ❌ 不要使用 stdout
console.log('Debug info:', data)  // 会破坏 MCP 通信
```

### 2. 查看日志文件

```bash
# macOS
tail -f ~/Library/Logs/Claude/mcp*.log

# Windows
type %APPDATA%\Claude\logs\mcp*.log

# Cursor
# 查看 Output 面板的 MCP 日志
```

### 3. 测试工具调用

```typescript
// 创建测试客户端
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const transport = new StdioClientTransport({
  command: 'node',
  args: ['server.js']
})

const client = new Client({ name: 'test', version: '1.0.0' }, {})
await client.connect(transport)

// 列出工具
const { tools } = await client.request({ method: 'tools/list' }, null)
console.log('Available tools:', tools)

// 调用工具
const result = await client.request(
  { method: 'tools/call' },
  { name: 'my_tool', arguments: { param: 'value' } }
)
console.log('Result:', result)
```

## 🎯 常见场景

### 1. API 集成

```typescript
import axios from 'axios'

const api = axios.create({
  baseURL: process.env.API_BASE_URL,
  headers: {
    'Authorization': `Bearer ${process.env.API_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  
  if (name === 'api_call') {
    const response = await api.get('/endpoint', { params: args })
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response.data)
      }]
    }
  }
})
```

### 2. 数据库查询

```typescript
import { Client } from 'pg'

const db = new Client({
  connectionString: process.env.DATABASE_URL
})
await db.connect()

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  
  if (name === 'query_users') {
    const result = await db.query(
      'SELECT * FROM users WHERE age > $1',
      [args.minAge]
    )
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result.rows)
      }]
    }
  }
})
```

### 3. 文件操作

```typescript
import fs from 'fs/promises'
import path from 'path'

const ALLOWED_DIR = '/safe/directory'

function validatePath(requestedPath: string): string {
  const fullPath = path.resolve(ALLOWED_DIR, requestedPath)
  if (!fullPath.startsWith(ALLOWED_DIR)) {
    throw new Error('Access denied')
  }
  return fullPath
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params
  
  if (name === 'read_file') {
    const safePath = validatePath(args.path)
    const content = await fs.readFile(safePath, 'utf-8')
    return {
      content: [{ type: 'text', text: content }]
    }
  }
})
```

## ⚠️ 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|---------|
| `Connection refused` | 服务器未启动 | 检查配置路径和命令 |
| `Tool not found` | 工具名称不匹配 | 确保工具名称一致 |
| `Invalid schema` | JSON Schema 错误 | 验证 schema 格式 |
| `stdout 被占用` | 使用了 console.log | 改用 console.error |
| `Timeout` | 操作超时 | 增加超时时间或优化逻辑 |

## 📚 类型定义速查

```typescript
// Tool 定义
interface Tool {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties?: Record<string, JSONSchema>
    required?: string[]
  }
}

// 工具调用请求
interface CallToolRequest {
  params: {
    name: string
    arguments: Record<string, any>
  }
}

// 工具调用响应
interface CallToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource'
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// 服务器配置
interface ServerConfig {
  name: string
  version: string
}

interface ServerCapabilities {
  capabilities: {
    tools?: {}
    resources?: {}
    prompts?: {}
  }
}
```

## 🔍 性能优化

### 1. 连接池

```typescript
import { Pool } from 'pg'

const pool = new Pool({
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})

// 使用连接池
const result = await pool.query('SELECT * FROM users')
```

### 2. 缓存

```typescript
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 600 }) // 10分钟过期

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const cacheKey = `${request.params.name}:${JSON.stringify(request.params.arguments)}`
  
  // 检查缓存
  const cached = cache.get(cacheKey)
  if (cached) {
    return cached
  }
  
  // 执行操作
  const result = await performOperation(request)
  
  // 存入缓存
  cache.set(cacheKey, result)
  
  return result
})
```

### 3. 批量操作

```typescript
// 使用 Promise.all 并行执行
const results = await Promise.all(
  items.map(item => processItem(item))
)

// 使用 Promise.allSettled 处理部分失败
const results = await Promise.allSettled(
  items.map(item => processItem(item))
)
```

## 📖 资源链接

- **MCP 规范**: https://spec.modelcontextprotocol.io/
- **TypeScript SDK**: https://github.com/modelcontextprotocol/typescript-sdk
- **Python SDK**: https://github.com/modelcontextprotocol/python-sdk
- **官方示例**: https://github.com/modelcontextprotocol/servers
- **Notion MCP**: https://github.com/makenotion/notion-mcp-server

---

**提示**: 将此文档保存为书签，开发时随时查阅！ 📌

