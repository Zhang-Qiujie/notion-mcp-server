# MCP Server 开发完整指南

## 📚 目录

1. [项目概览](#项目概览)
2. [核心概念](#核心概念)
3. [项目架构](#项目架构)
4. [关键组件详解](#关键组件详解)
5. [工作流程](#工作流程)
6. [如何编写自己的 MCP Server](#如何编写自己的-mcp-server)
7. [实战示例](#实战示例)
8. [最佳实践](#最佳实践)

---

## 项目概览

### 什么是 MCP？

**MCP (Model Context Protocol)** 是一个标准协议，用于让 AI 模型（如 Claude）与外部工具和数据源进行通信。

### 这个项目做什么？

这是一个 **OpenAPI 到 MCP 的桥接服务器**，它能够：
- 读取任何 OpenAPI/Swagger 规范文件
- 自动将 API 端点转换为 MCP 工具
- 让 AI 助手能够调用这些 API

### 核心优势

✅ **自动化转换**：无需手动编写每个工具  
✅ **通用性**：支持任何符合 OpenAPI 3.x 规范的 API  
✅ **双传输模式**：支持 STDIO 和 HTTP 传输  
✅ **完整的错误处理**：包含详细的错误响应信息

---

## 核心概念

### 1. MCP 架构的三要素

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│             │  MCP    │             │  HTTP   │             │
│  AI Client  │ ◄─────► │ MCP Server  │ ◄─────► │  Real API   │
│  (Claude)   │         │  (Proxy)    │         │   (Notion)  │
└─────────────┘         └─────────────┘         └─────────────┘
```

### 2. 核心组件

| 组件 | 文件 | 作用 |
|------|------|------|
| **入口** | `scripts/start-server.ts` | 启动服务器，处理命令行参数 |
| **初始化** | `src/init-server.ts` | 加载 OpenAPI 规范，创建代理 |
| **代理层** | `src/openapi-mcp-server/mcp/proxy.ts` | MCP 协议实现核心 |
| **转换器** | `src/openapi-mcp-server/openapi/parser.ts` | OpenAPI → MCP 工具转换 |
| **HTTP 客户端** | `src/openapi-mcp-server/client/http-client.ts` | 执行实际的 API 调用 |

### 3. 数据流

```
1. 读取 OpenAPI 规范 (notion-openapi.json)
   ↓
2. 解析并转换为 MCP 工具定义 (OpenAPIToMCPConverter)
   ↓
3. 注册工具到 MCP Server (MCPProxy)
   ↓
4. 监听 AI 客户端请求 (ListTools / CallTool)
   ↓
5. 执行对应的 HTTP API 调用 (HttpClient)
   ↓
6. 返回结果给 AI 客户端
```

---

## 项目架构

### 目录结构

```
notion-mcp-server/
├── scripts/
│   ├── start-server.ts          # 服务器启动入口
│   └── notion-openapi.json      # Notion API OpenAPI 规范
├── src/
│   ├── init-server.ts           # 服务器初始化
│   └── openapi-mcp-server/
│       ├── mcp/
│       │   └── proxy.ts         # MCP 协议代理实现
│       ├── openapi/
│       │   └── parser.ts        # OpenAPI 解析器
│       └── client/
│           └── http-client.ts   # HTTP 客户端
├── package.json
└── tsconfig.json
```

---

## 关键组件详解

### 1. 服务器启动 (`start-server.ts`)

```typescript
// 核心逻辑
export async function startServer(args: string[] = process.argv) {
  // 1. 解析命令行参数
  const options = parseArgs()
  
  // 2. 选择传输模式
  if (transport === 'stdio') {
    // STDIO 模式：用于 Claude Desktop 等桌面客户端
    const proxy = await initProxy(specPath, baseUrl)
    await proxy.connect(new StdioServerTransport())
  } else if (transport === 'http') {
    // HTTP 模式：用于 Web 应用
    const app = express()
    // 设置身份验证、路由等
    const transport = new StreamableHTTPServerTransport(...)
    const proxy = await initProxy(specPath, baseUrl)
    await proxy.connect(transport)
  }
}
```

**关键点**：
- 支持两种传输模式：`stdio` 和 `http`
- 使用环境变量 `NOTION_TOKEN` 或 `OPENAPI_MCP_HEADERS` 进行认证
- HTTP 模式需要 Bearer Token 认证

### 2. 初始化代理 (`init-server.ts`)

```typescript
export async function initProxy(specPath: string, baseUrl: string | undefined) {
  // 1. 加载 OpenAPI 规范文件
  const openApiSpec = await loadOpenApiSpec(specPath, baseUrl)
  
  // 2. 创建 MCP 代理
  const proxy = new MCPProxy('Notion API', openApiSpec)
  
  return proxy
}
```

### 3. MCP 代理 (`proxy.ts`)

这是整个系统的核心！

```typescript
export class MCPProxy {
  private server: Server                    // MCP SDK 服务器实例
  private httpClient: HttpClient            // HTTP 客户端
  private tools: Record<string, ToolDef>    // MCP 工具定义
  private openApiLookup: Record<...>        // OpenAPI 操作查找表

  constructor(name: string, openApiSpec: OpenAPIV3.Document) {
    // 1. 创建 MCP Server
    this.server = new Server(
      { name, version: '1.0.0' }, 
      { capabilities: { tools: {} } }
    )
    
    // 2. 创建 HTTP 客户端
    this.httpClient = new HttpClient({
      baseUrl,
      headers: this.parseHeadersFromEnv()
    }, openApiSpec)
    
    // 3. 转换 OpenAPI → MCP 工具
    const converter = new OpenAPIToMCPConverter(openApiSpec)
    const { tools, openApiLookup } = converter.convertToMCPTools()
    this.tools = tools
    this.openApiLookup = openApiLookup
    
    // 4. 设置请求处理器
    this.setupHandlers()
  }

  private setupHandlers() {
    // 处理工具列表请求
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = []
      Object.entries(this.tools).forEach(([toolName, def]) => {
        def.methods.forEach(method => {
          tools.push({
            name: method.name,
            description: method.description,
            inputSchema: method.inputSchema,
            annotations: {
              title: this.operationIdToTitle(method.name),
              readOnlyHint: httpMethod === 'get',
              destructiveHint: httpMethod !== 'get'
            }
          })
        })
      })
      return { tools }
    })

    // 处理工具调用请求
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: params } = request.params
      
      // 1. 查找对应的 OpenAPI 操作
      const operation = this.findOperation(name)
      
      // 2. 执行 HTTP 调用
      const response = await this.httpClient.executeOperation(operation, params)
      
      // 3. 返回结果
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data)
        }]
      }
    })
  }
}
```

**关键理解**：
1. `ListToolsRequestSchema`：AI 询问"你有哪些工具？"
2. `CallToolRequestSchema`：AI 说"帮我执行这个工具"
3. 每个 OpenAPI 操作 → 一个 MCP 工具

### 4. OpenAPI 转换器 (`parser.ts`)

```typescript
export class OpenAPIToMCPConverter {
  convertToMCPTools() {
    const tools: Record<string, ToolDef> = {}
    const openApiLookup: Record<...> = {}
    
    // 遍历所有 API 路径
    for (const [path, pathItem] of Object.entries(this.openApiSpec.paths)) {
      // 遍历所有 HTTP 方法 (GET, POST, etc.)
      for (const [method, operation] of Object.entries(pathItem)) {
        if (!this.isOperation(method, operation)) continue
        
        // 转换为 MCP 方法
        const mcpMethod = this.convertOperationToMCPMethod(operation, method, path)
        
        if (mcpMethod) {
          tools[apiName].methods.push(mcpMethod)
          openApiLookup[toolName] = { ...operation, method, path }
        }
      }
    }
    
    return { tools, openApiLookup }
  }

  private convertOperationToMCPMethod(operation, method, path): NewToolMethod {
    const inputSchema: JSONSchema = {
      type: 'object',
      properties: {},
      required: []
    }
    
    // 1. 处理路径/查询参数
    if (operation.parameters) {
      for (const param of operation.parameters) {
        inputSchema.properties[param.name] = 
          this.convertOpenApiSchemaToJsonSchema(param.schema)
        if (param.required) {
          inputSchema.required.push(param.name)
        }
      }
    }
    
    // 2. 处理请求体
    if (operation.requestBody?.content?.['application/json']) {
      const bodySchema = operation.requestBody.content['application/json'].schema
      // 合并到 inputSchema
      Object.assign(inputSchema.properties, bodySchema.properties)
    }
    
    // 3. 提取响应类型
    const returnSchema = this.extractResponseType(operation.responses)
    
    return {
      name: operation.operationId,
      description: operation.summary || operation.description,
      inputSchema,
      returnSchema
    }
  }
}
```

### 5. HTTP 客户端 (`http-client.ts`)

```typescript
export class HttpClient {
  private api: Promise<AxiosInstance>
  
  constructor(config: HttpClientConfig, openApiSpec: OpenAPIV3.Document) {
    // 使用 openapi-client-axios 自动生成 API 客户端
    this.client = new OpenAPIClientAxios({
      definition: openApiSpec,
      axiosConfigDefaults: {
        baseURL: config.baseUrl,
        headers: {
          'Content-Type': 'application/json',
          ...config.headers
        }
      }
    })
    this.api = this.client.init()
  }

  async executeOperation(operation, params) {
    const api = await this.api
    const operationId = operation.operationId
    
    // 1. 处理文件上传（如果需要）
    const formData = await this.prepareFileUpload(operation, params)
    
    // 2. 分离 URL 参数和 Body 参数
    const urlParameters: Record<string, any> = {}
    const bodyParams: Record<string, any> = { ...params }
    
    // 3. 执行 API 调用
    const operationFn = api[operationId]
    const response = await operationFn(urlParameters, bodyParams, requestConfig)
    
    return {
      data: response.data,
      status: response.status,
      headers: response.headers
    }
  }
}
```

---

## 工作流程

### 完整的请求-响应流程

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AI 客户端启动                                              │
│    Claude Desktop 读取 mcp.json 配置                          │
│    启动 notion-mcp-server 进程                                │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. 服务器初始化                                               │
│    • 加载 notion-openapi.json                                 │
│    • OpenAPIToMCPConverter 解析规范                           │
│    • 生成 21 个 MCP 工具                                       │
│    • MCPProxy 注册请求处理器                                   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. AI 发现工具                                                │
│    AI: ListToolsRequest →                                    │
│    Server: 返回所有可用工具列表                                │
│    ← [{name: "search", description: "Search Notion", ...}]   │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. 用户请求                                                   │
│    User: "在我的 Notion 中搜索 'MCP'"                          │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. AI 选择并调用工具                                           │
│    AI: CallToolRequest                                       │
│    {                                                         │
│      name: "search",                                         │
│      arguments: { query: "MCP" }                             │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. MCP Server 处理                                            │
│    • MCPProxy 接收请求                                         │
│    • 查找 openApiLookup["search"]                             │
│    • 找到：POST /v1/search                                    │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. HTTP 调用                                                  │
│    • HttpClient.executeOperation()                           │
│    • 构建请求：                                               │
│      POST https://api.notion.com/v1/search                   │
│      Headers: { Authorization: "Bearer ntn_..." }            │
│      Body: { query: "MCP" }                                  │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. Notion API 响应                                            │
│    ← { results: [...pages...] }                              │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 9. 返回给 AI                                                  │
│    Server → AI: {                                            │
│      content: [{                                             │
│        type: "text",                                         │
│        text: '{"results": [...]}'                            │
│      }]                                                      │
│    }                                                         │
└──────────────────────┬──────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ 10. AI 处理并展示                                             │
│     Claude 解析 JSON，生成人类可读的回复                        │
│     "我找到了以下页面：..."                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 如何编写自己的 MCP Server

### 方法 1: 基于 OpenAPI（推荐）

如果你的 API 有 OpenAPI 规范，直接复用这个项目！

#### 步骤 1: 准备 OpenAPI 规范

```json
// my-api-openapi.json
{
  "openapi": "3.0.0",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "servers": [
    {
      "url": "https://api.myservice.com"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "operationId": "listUsers",
        "summary": "List all users",
        "responses": {
          "200": {
            "description": "Success",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": { "type": "string" },
                      "name": { "type": "string" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

#### 步骤 2: 修改服务器启动代码

```typescript
// scripts/start-my-server.ts
import { initProxy } from '../src/init-server'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

async function startServer() {
  const specPath = './my-api-openapi.json'
  const baseUrl = process.env.BASE_URL
  
  const proxy = await initProxy(specPath, baseUrl)
  await proxy.connect(new StdioServerTransport())
}

startServer().catch(console.error)
```

#### 步骤 3: 配置环境变量

```json
// .cursor/mcp.json 或 claude_desktop_config.json
{
  "mcpServers": {
    "myApi": {
      "command": "node",
      "args": ["dist/scripts/start-my-server.js"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer my-api-key\"}"
      }
    }
  }
}
```

### 方法 2: 从零开始手写 MCP Server

如果没有 OpenAPI 规范，需要手动定义工具。

#### 完整示例：天气查询 MCP Server

```typescript
// weather-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from '@modelcontextprotocol/sdk/types.js'
import axios from 'axios'

// 1. 创建服务器实例
const server = new Server(
  {
    name: 'weather-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// 2. 定义工具列表
const TOOLS: Tool[] = [
  {
    name: 'get_weather',
    description: '获取指定城市的天气信息',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称，例如：北京、上海'
        },
        unit: {
          type: 'string',
          enum: ['celsius', 'fahrenheit'],
          description: '温度单位',
          default: 'celsius'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'get_forecast',
    description: '获取未来 7 天的天气预报',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: '城市名称'
        },
        days: {
          type: 'number',
          description: '预报天数（1-7）',
          minimum: 1,
          maximum: 7,
          default: 3
        }
      },
      required: ['city']
    }
  }
]

// 3. 注册工具列表处理器
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

// 4. 注册工具调用处理器
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === 'get_weather') {
      // 调用实际的天气 API
      const response = await axios.get('https://api.weather.com/v1/current', {
        params: {
          city: args.city,
          unit: args.unit || 'celsius',
          apikey: process.env.WEATHER_API_KEY
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              city: args.city,
              temperature: response.data.temperature,
              condition: response.data.condition,
              humidity: response.data.humidity,
              wind_speed: response.data.wind_speed
            })
          }
        ]
      }
    } 
    else if (name === 'get_forecast') {
      const response = await axios.get('https://api.weather.com/v1/forecast', {
        params: {
          city: args.city,
          days: args.days || 3,
          apikey: process.env.WEATHER_API_KEY
        }
      })

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(response.data.forecast)
          }
        ]
      }
    }
    
    throw new Error(`Unknown tool: ${name}`)
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            details: error.response?.data || {}
          })
        }
      ],
      isError: true
    }
  }
})

// 5. 连接传输层并启动
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Weather MCP Server running on stdio')
}

main().catch(console.error)
```

#### 编译和配置

```bash
# 1. 编译 TypeScript
npx tsc weather-mcp-server.ts

# 2. 配置到 Claude Desktop
```

```json
// claude_desktop_config.json
{
  "mcpServers": {
    "weather": {
      "command": "node",
      "args": ["path/to/weather-mcp-server.js"],
      "env": {
        "WEATHER_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

---

## 实战示例

### 示例 1: 数据库 MCP Server

```typescript
// database-mcp-server.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { Client } from 'pg' // PostgreSQL 客户端

const server = new Server(
  { name: 'database-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 创建数据库连接
const db = new Client({
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

await db.connect()

// 定义工具
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'query_database',
        description: '执行 SQL 查询（仅 SELECT）',
        inputSchema: {
          type: 'object',
          properties: {
            sql: {
              type: 'string',
              description: 'SQL SELECT 查询语句'
            },
            params: {
              type: 'array',
              description: '查询参数（可选）',
              items: { type: 'string' }
            }
          },
          required: ['sql']
        }
      },
      {
        name: 'get_schema',
        description: '获取数据库表结构',
        inputSchema: {
          type: 'object',
          properties: {
            table_name: {
              type: 'string',
              description: '表名（可选，留空获取所有表）'
            }
          }
        }
      }
    ]
  }
})

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  if (name === 'query_database') {
    // 安全检查：只允许 SELECT
    if (!args.sql.trim().toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed')
    }

    const result = await db.query(args.sql, args.params || [])
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          rows: result.rows,
          rowCount: result.rowCount
        })
      }]
    }
  }

  if (name === 'get_schema') {
    const query = args.table_name
      ? `SELECT * FROM information_schema.columns WHERE table_name = $1`
      : `SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public'`
    
    const result = await db.query(query, args.table_name ? [args.table_name] : [])
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result.rows)
      }]
    }
  }

  throw new Error(`Unknown tool: ${name}`)
})

// 启动服务器
const transport = new StdioServerTransport()
await server.connect(transport)
```

### 示例 2: 文件系统 MCP Server

```typescript
// filesystem-mcp-server.ts
import fs from 'fs/promises'
import path from 'path'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'filesystem-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
)

// 定义允许访问的根目录
const ALLOWED_ROOT = process.env.FS_ROOT || process.cwd()

// 安全检查函数
function validatePath(requestedPath: string): string {
  const fullPath = path.resolve(ALLOWED_ROOT, requestedPath)
  if (!fullPath.startsWith(ALLOWED_ROOT)) {
    throw new Error('Access denied: path outside allowed root')
  }
  return fullPath
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'read_file',
        description: '读取文件内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: '写入文件',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '文件路径' },
            content: { type: 'string', description: '文件内容' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'list_directory',
        description: '列出目录内容',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '目录路径' }
          },
          required: ['path']
        }
      }
    ]
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    if (name === 'read_file') {
      const safePath = validatePath(args.path)
      const content = await fs.readFile(safePath, 'utf-8')
      return {
        content: [{ type: 'text', text: content }]
      }
    }

    if (name === 'write_file') {
      const safePath = validatePath(args.path)
      await fs.writeFile(safePath, args.content, 'utf-8')
      return {
        content: [{ type: 'text', text: 'File written successfully' }]
      }
    }

    if (name === 'list_directory') {
      const safePath = validatePath(args.path)
      const entries = await fs.readdir(safePath, { withFileTypes: true })
      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file'
      }))
      return {
        content: [{ type: 'text', text: JSON.stringify(files, null, 2) }]
      }
    }

    throw new Error(`Unknown tool: ${name}`)
  } catch (error: any) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ error: error.message })
      }],
      isError: true
    }
  }
})

const transport = new StdioServerTransport()
await server.connect(transport)
```

---

## 最佳实践

### 1. 安全性

```typescript
// ✅ 好的做法
- 验证所有输入参数
- 使用环境变量存储敏感信息
- 限制允许的操作（如只读访问）
- 路径遍历保护

// ❌ 避免
- 硬编码 API 密钥
- 允许任意 SQL 执行
- 不验证文件路径
```

### 2. 错误处理

```typescript
// ✅ 好的做法
try {
  const result = await apiCall()
  return {
    content: [{ type: 'text', text: JSON.stringify(result) }]
  }
} catch (error: any) {
  // 返回结构化错误，而不是抛出异常
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        error: error.message,
        code: error.code,
        details: error.response?.data
      })
    }],
    isError: true
  }
}
```

### 3. 工具设计

```typescript
// ✅ 好的工具描述
{
  name: 'create_task',
  description: '在项目管理系统中创建新任务',
  inputSchema: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: '任务标题（必填，不超过 100 字符）'
      },
      description: {
        type: 'string',
        description: '任务详细描述（可选）'
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: '任务优先级',
        default: 'medium'
      }
    },
    required: ['title']
  }
}

// ❌ 不好的描述
{
  name: 'create',  // 名称太泛化
  description: 'create something',  // 描述不清楚
  inputSchema: {
    type: 'object',
    properties: {
      data: { type: 'object' }  // 缺少具体说明
    }
  }
}
```

### 4. 性能优化

```typescript
// 连接池
const pool = new Pool({
  max: 20,
  connectionTimeoutMillis: 2000,
})

// 缓存频繁访问的数据
const cache = new Map<string, any>()

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const cacheKey = `${request.params.name}:${JSON.stringify(request.params.arguments)}`
  
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)
  }
  
  const result = await executeOperation(request)
  cache.set(cacheKey, result)
  
  return result
})
```

### 5. 日志记录

```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  logger.info('Tool call received', {
    tool: request.params.name,
    args: request.params.arguments
  })

  try {
    const result = await handleToolCall(request)
    logger.info('Tool call succeeded', { tool: request.params.name })
    return result
  } catch (error) {
    logger.error('Tool call failed', {
      tool: request.params.name,
      error: error.message
    })
    throw error
  }
})
```

### 6. 测试

```typescript
// __tests__/weather-server.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

describe('Weather MCP Server', () => {
  let client: Client
  
  beforeAll(async () => {
    // 启动服务器进程
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['dist/weather-mcp-server.js'],
      env: {
        WEATHER_API_KEY: 'test-key'
      }
    })
    
    client = new Client({
      name: 'test-client',
      version: '1.0.0'
    }, { capabilities: {} })
    
    await client.connect(transport)
  })
  
  afterAll(async () => {
    await client.close()
  })
  
  it('should list available tools', async () => {
    const response = await client.request({ method: 'tools/list' }, null)
    
    expect(response.tools).toHaveLength(2)
    expect(response.tools[0].name).toBe('get_weather')
  })
  
  it('should get weather for a city', async () => {
    const response = await client.request(
      { method: 'tools/call' },
      {
        name: 'get_weather',
        arguments: { city: '北京', unit: 'celsius' }
      }
    )
    
    const data = JSON.parse(response.content[0].text)
    expect(data).toHaveProperty('temperature')
    expect(data.city).toBe('北京')
  })
})
```

---

## 总结

### MCP Server 开发的核心要点

1. **理解协议**：MCP 是一个请求-响应协议
   - `tools/list`：列出所有工具
   - `tools/call`：调用特定工具

2. **两种开发方式**：
   - 基于 OpenAPI（自动化，适合已有 API）
   - 手写定义（灵活，适合自定义逻辑）

3. **关键组件**：
   - Server：处理请求
   - Transport：通信层（stdio/http）
   - Tools：具体功能实现

4. **最佳实践**：
   - 详细的工具描述
   - 完善的错误处理
   - 安全验证
   - 性能优化

### 下一步学习

1. **阅读官方文档**：https://spec.modelcontextprotocol.io/
2. **研究其他 MCP Server**：
   - https://github.com/modelcontextprotocol/servers
3. **实践项目**：
   - 为你常用的 API 创建 MCP Server
   - 尝试添加新功能到这个 Notion MCP Server

### 资源链接

- MCP 规范：https://spec.modelcontextprotocol.io/
- MCP SDK：https://github.com/modelcontextprotocol/typescript-sdk
- Notion MCP Server：https://github.com/makenotion/notion-mcp-server
- OpenAPI 规范：https://swagger.io/specification/

---

**祝你学习愉快！有任何问题欢迎提问。** 🚀

