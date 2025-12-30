# MCP Server 开发学习路径

> 从零基础到精通 MCP Server 开发的完整学习路径

## 🎯 学习目标

完成本学习路径后，你将能够：
- ✅ 理解 MCP 协议的工作原理
- ✅ 使用 TypeScript 开发 MCP Server
- ✅ 将任何 API 转换为 MCP Server
- ✅ 设计和实现自定义工具
- ✅ 部署和维护生产级 MCP Server

## 📅 学习时间估算

- **快速入门**: 2-3 小时
- **深入理解**: 1-2 天
- **实战项目**: 3-5 天
- **精通优化**: 1-2 周

---

## 第一阶段：基础理解（2-3 小时）

### 目标
理解 MCP 是什么，为什么需要它

### 学习内容

#### 1. 阅读概念文档（30 分钟）

📖 **必读**:
- [ ] `MCP_SERVER_学习指南.md` - 第 1-2 章
- [ ] 理解 MCP 的三要素：Server, Transport, Tools

💡 **关键概念**:
- MCP 是什么？
- AI 如何通过 MCP 调用工具？
- STDIO vs HTTP 传输的区别

#### 2. 观察实际运行（30 分钟）

🔬 **实践步骤**:

```bash
# 1. 安装依赖
cd notion-mcp-server
npm install

# 2. 配置 Notion Token
export NOTION_TOKEN="ntn_your_token_here"

# 3. 运行服务器
npm run dev
```

📝 **观察要点**:
- 服务器启动过程
- 加载了哪些工具
- 日志输出了什么信息

#### 3. 配置到 Claude Desktop（1 小时）

🛠️ **配置步骤**:

1. 打开配置文件：
   ```bash
   # macOS
   code ~/Library/Application\ Support/Claude/claude_desktop_config.json
   
   # Windows
   code %APPDATA%\Claude\claude_desktop_config.json
   ```

2. 添加配置：
   ```json
   {
     "mcpServers": {
       "notion": {
         "command": "npx",
         "args": ["-y", "@notionhq/notion-mcp-server"],
         "env": {
           "NOTION_TOKEN": "ntn_your_token_here"
         }
       }
     }
   }
   ```

3. 重启 Claude Desktop

4. 测试对话：
   ```
   你：帮我在 Notion 中搜索 "MCP"
   AI：[调用 search 工具]
   ```

#### 4. 理解数据流（1 小时）

📊 **追踪一次完整的调用**:

```
用户请求 → Claude 理解意图 → 选择工具 → 调用 MCP Server 
→ Server 执行 API 调用 → 返回结果 → Claude 生成回复
```

✏️ **练习**: 
- 在代码中添加 `console.error()` 日志
- 追踪一次 `search` 工具的完整调用过程
- 理解每一步发生了什么

---

## 第二阶段：动手实践（1-2 天）

### 目标
能够从零开始编写一个简单的 MCP Server

### Day 1: 手写 MCP Server

#### 1. 运行示例项目（1 小时）

📂 **运行 Todo Server**:

```bash
cd examples
npx tsx simple-todo-mcp-server.ts
```

📝 **学习任务**:
- [ ] 阅读完整代码（有详细注释）
- [ ] 理解每个部分的作用
- [ ] 尝试添加 `console.error()` 日志

#### 2. 修改示例代码（2 小时）

🔧 **练习任务**:

**任务 1**: 添加优先级功能
```typescript
interface Todo {
  // ... 现有字段
  priority: 'low' | 'medium' | 'high'
}

// 添加新工具
{
  name: 'set_priority',
  description: '设置待办事项优先级',
  inputSchema: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high']
      }
    },
    required: ['id', 'priority']
  }
}
```

**任务 2**: 添加截止日期
```typescript
interface Todo {
  // ... 现有字段
  dueDate?: string
}

// 添加工具
{
  name: 'get_overdue',
  description: '获取过期的待办事项'
}
```

**任务 3**: 添加搜索功能
```typescript
{
  name: 'search_todos',
  description: '搜索待办事项',
  inputSchema: {
    type: 'object',
    properties: {
      keyword: { type: 'string' }
    },
    required: ['keyword']
  }
}
```

#### 3. 从零创建新 Server（3 小时）

🎯 **项目**: 创建一个天气查询 MCP Server

```typescript
// weather-server.ts
// 要求：
// 1. 注册到免费天气 API (如 weatherapi.com)
// 2. 实现 3 个工具：
//    - get_current_weather
//    - get_forecast
//    - get_air_quality
// 3. 配置到 Claude Desktop 测试
```

📚 **参考资料**:
- `examples/simple-todo-mcp-server.ts`
- `MCP_快速参考手册.md`

### Day 2: 理解 OpenAPI 架构

#### 1. 分析 Notion MCP Server（2 小时）

🔍 **代码阅读清单**:

- [ ] `src/init-server.ts` - 理解初始化流程
- [ ] `src/openapi-mcp-server/mcp/proxy.ts` - 理解代理模式
- [ ] `src/openapi-mcp-server/openapi/parser.ts` - 理解转换逻辑
- [ ] `src/openapi-mcp-server/client/http-client.ts` - 理解 HTTP 调用

📝 **学习笔记**:
```
1. OpenAPI 规范如何被加载？
   → loadOpenApiSpec() 读取 JSON 文件

2. 如何转换为 MCP 工具？
   → OpenAPIToMCPConverter.convertToMCPTools()

3. 工具调用如何执行？
   → MCPProxy.handleToolCall() → HttpClient.executeOperation()

4. 错误如何处理？
   → HttpClientError 统一错误格式
```

#### 2. 创建自己的 OpenAPI Server（4 小时）

🎯 **项目**: 为 GitHub API 创建 MCP Server

**步骤 1**: 获取 GitHub OpenAPI 规范
```bash
# GitHub 提供官方 OpenAPI 规范
curl https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json -o github-api.json
```

**步骤 2**: 创建服务器
```typescript
// github-mcp-server.ts
import { initProxy } from './src/init-server'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

async function start() {
  const proxy = await initProxy('./github-api.json', undefined)
  await proxy.connect(new StdioServerTransport())
}

start()
```

**步骤 3**: 配置环境变量
```json
{
  "mcpServers": {
    "github": {
      "command": "node",
      "args": ["github-mcp-server.js"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ghp_your_token\"}"
      }
    }
  }
}
```

**步骤 4**: 测试
```
你：列出我的 GitHub 仓库
AI：[调用 list-repos 工具]

你：创建一个新 issue
AI：[调用 create-issue 工具]
```

---

## 第三阶段：深入实战（3-5 天）

### 目标
开发一个生产级的 MCP Server 项目

### 项目选择（选择一个）

#### 选项 1: 数据库管理 MCP Server

**功能需求**:
- ✅ 连接 PostgreSQL/MySQL 数据库
- ✅ 执行安全的 SELECT 查询
- ✅ 查看表结构和关系
- ✅ 生成数据统计报告

**技术要点**:
- 连接池管理
- SQL 注入防护
- 查询结果格式化

**难度**: ⭐⭐⭐

#### 选项 2: 文件系统 MCP Server

**功能需求**:
- ✅ 读取/写入文件
- ✅ 列出目录内容
- ✅ 搜索文件
- ✅ 文件操作（复制、移动、删除）

**技术要点**:
- 路径安全验证
- 文件权限检查
- 大文件处理

**难度**: ⭐⭐

#### 选项 3: 微服务集成 MCP Server

**功能需求**:
- ✅ 集成 3+ 个微服务 API
- ✅ 统一的错误处理
- ✅ 请求缓存
- ✅ 日志和监控

**技术要点**:
- API 编排
- 缓存策略
- 性能优化

**难度**: ⭐⭐⭐⭐

### 开发流程

#### Week 1: 设计和基础功能

**Day 1-2: 需求分析和设计**
- [ ] 定义工具列表
- [ ] 设计数据模型
- [ ] 设计 API 接口
- [ ] 画架构图

**Day 3-4: 核心功能开发**
- [ ] 实现基础工具
- [ ] 编写单元测试
- [ ] 集成测试

**Day 5: 错误处理和优化**
- [ ] 完善错误处理
- [ ] 添加输入验证
- [ ] 性能优化

#### Week 2: 高级功能和部署

**Day 1-2: 高级功能**
- [ ] 添加缓存
- [ ] 添加日志
- [ ] 添加监控

**Day 3: 文档和测试**
- [ ] 编写 README
- [ ] 编写使用文档
- [ ] 完善测试覆盖

**Day 4-5: 部署和优化**
- [ ] Docker 化
- [ ] CI/CD 配置
- [ ] 性能测试和优化

---

## 第四阶段：进阶优化（1-2 周）

### 目标
掌握生产环境的最佳实践

### 1. 性能优化（2-3 天）

#### 学习内容

**连接池管理**:
```typescript
import { Pool } from 'pg'

const pool = new Pool({
  max: 20,
  min: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000
})
```

**请求缓存**:
```typescript
import NodeCache from 'node-cache'

const cache = new NodeCache({ 
  stdTTL: 600,
  checkperiod: 120
})

// 缓存工具调用结果
const cacheKey = generateCacheKey(request)
const cached = cache.get(cacheKey)
if (cached) return cached
```

**批量操作**:
```typescript
// 并行处理
const results = await Promise.all(
  items.map(item => processItem(item))
)

// 限制并发数
import pLimit from 'p-limit'
const limit = pLimit(5)
const results = await Promise.all(
  items.map(item => limit(() => processItem(item)))
)
```

#### 实践任务
- [ ] 为你的项目添加连接池
- [ ] 实现智能缓存策略
- [ ] 优化批量操作
- [ ] 进行性能测试

### 2. 安全加固（2-3 天）

#### 学习内容

**输入验证**:
```typescript
import Ajv from 'ajv'

const ajv = new Ajv()
const validate = ajv.compile(inputSchema)

if (!validate(args)) {
  throw new Error('Invalid input: ' + ajv.errorsText(validate.errors))
}
```

**路径遍历防护**:
```typescript
import path from 'path'

function validatePath(requestedPath: string): string {
  const fullPath = path.resolve(ALLOWED_ROOT, requestedPath)
  if (!fullPath.startsWith(ALLOWED_ROOT)) {
    throw new Error('Path traversal detected')
  }
  return fullPath
}
```

**SQL 注入防护**:
```typescript
// ❌ 危险
const result = await db.query(`SELECT * FROM users WHERE id = ${userId}`)

// ✅ 安全
const result = await db.query('SELECT * FROM users WHERE id = $1', [userId])
```

**速率限制**:
```typescript
import ratelimit from 'express-rate-limit'

const limiter = ratelimit({
  windowMs: 15 * 60 * 1000,
  max: 100
})
```

#### 实践任务
- [ ] 添加输入验证
- [ ] 实现路径安全检查
- [ ] 防止 SQL 注入
- [ ] 添加速率限制

### 3. 监控和日志（2-3 天）

#### 学习内容

**结构化日志**:
```typescript
import winston from 'winston'

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})

// 使用
logger.info('Tool called', {
  tool: request.params.name,
  args: request.params.arguments,
  timestamp: new Date().toISOString()
})
```

**性能监控**:
```typescript
// 记录执行时间
const start = Date.now()
const result = await executeOperation(request)
const duration = Date.now() - start

logger.info('Operation completed', {
  tool: request.params.name,
  duration,
  success: true
})
```

**错误追踪**:
```typescript
try {
  await executeOperation(request)
} catch (error) {
  logger.error('Operation failed', {
    tool: request.params.name,
    error: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  })
  
  // 发送到错误追踪服务（如 Sentry）
  Sentry.captureException(error)
}
```

#### 实践任务
- [ ] 集成 Winston 日志
- [ ] 添加性能监控
- [ ] 集成错误追踪服务
- [ ] 创建监控仪表板

### 4. 测试完善（2-3 天）

#### 学习内容

**单元测试**:
```typescript
import { describe, it, expect } from 'vitest'

describe('TodoStore', () => {
  it('should create a todo', () => {
    const store = new TodoStore()
    const todo = store.create('Test', 'Description')
    
    expect(todo.id).toBeDefined()
    expect(todo.title).toBe('Test')
    expect(todo.completed).toBe(false)
  })
})
```

**集成测试**:
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'

describe('MCP Server Integration', () => {
  it('should list tools', async () => {
    const client = createTestClient()
    const response = await client.request({ method: 'tools/list' }, null)
    
    expect(response.tools).toHaveLength(8)
    expect(response.tools[0].name).toBe('create_todo')
  })
})
```

**端到端测试**:
```typescript
describe('E2E: Todo Workflow', () => {
  it('should complete full workflow', async () => {
    // 1. 创建待办
    const created = await callTool('create_todo', { title: 'Test' })
    
    // 2. 列出待办
    const list = await callTool('list_todos', {})
    expect(list.todos).toHaveLength(1)
    
    // 3. 完成待办
    await callTool('complete_todo', { id: created.todo.id })
    
    // 4. 验证状态
    const stats = await callTool('get_stats', {})
    expect(stats.stats.completed).toBe(1)
  })
})
```

#### 实践任务
- [ ] 编写单元测试（覆盖率 >80%）
- [ ] 编写集成测试
- [ ] 编写端到端测试
- [ ] 设置 CI/CD 自动测试

---

## 第五阶段：生产部署（3-5 天）

### 1. Docker 化（1 天）

```dockerfile
# Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --production

COPY . .
RUN npm run build

CMD ["node", "dist/server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-server:
    build: .
    environment:
      - API_KEY=${API_KEY}
    ports:
      - "3000:3000"
    restart: unless-stopped
```

### 2. CI/CD 配置（1 天）

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run build
```

### 3. 监控和告警（1 天）

- [ ] 配置健康检查端点
- [ ] 设置日志聚合
- [ ] 配置告警规则
- [ ] 创建监控仪表板

### 4. 文档完善（1 天）

- [ ] API 文档
- [ ] 部署文档
- [ ] 故障排查文档
- [ ] 用户使用指南

---

## 📚 推荐学习资源

### 官方文档
- [MCP 协议规范](https://spec.modelcontextprotocol.io/)
- [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [OpenAPI 规范](https://swagger.io/specification/)

### 示例项目
- [官方示例集合](https://github.com/modelcontextprotocol/servers)
- [Notion MCP Server](https://github.com/makenotion/notion-mcp-server)
- [Slack MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/slack)

### 社区资源
- [MCP Discord](https://discord.gg/modelcontextprotocol)
- [GitHub Discussions](https://github.com/modelcontextprotocol/typescript-sdk/discussions)

---

## ✅ 学习检查清单

### 基础阶段
- [ ] 理解 MCP 是什么
- [ ] 能够运行现有的 MCP Server
- [ ] 能够配置 MCP Server 到 Claude Desktop
- [ ] 理解完整的数据流

### 实践阶段
- [ ] 能够从零编写简单的 MCP Server
- [ ] 理解 OpenAPI 自动化架构
- [ ] 能够为任何 API 创建 MCP Server
- [ ] 能够设计合理的工具定义

### 进阶阶段
- [ ] 能够进行性能优化
- [ ] 能够实施安全最佳实践
- [ ] 能够添加完善的日志和监控
- [ ] 能够编写全面的测试

### 生产阶段
- [ ] 能够 Docker 化应用
- [ ] 能够配置 CI/CD
- [ ] 能够部署到生产环境
- [ ] 能够编写完善的文档

---

## 🎓 认证和成就

完成以下项目，你就可以称自己为 MCP Server 开发专家：

### 初级认证
- ✅ 完成 Todo MCP Server 所有练习
- ✅ 创建一个天气查询 MCP Server
- ✅ 配置到 Claude Desktop 并成功使用

### 中级认证
- ✅ 为一个第三方 API 创建 MCP Server
- ✅ 实现完整的错误处理和日志
- ✅ 编写测试覆盖率 >80% 的代码

### 高级认证
- ✅ 开发一个生产级的 MCP Server 项目
- ✅ 实现性能优化和安全加固
- ✅ 完成 Docker 化和 CI/CD 配置
- ✅ 部署到生产环境并稳定运行

---

## 💡 学习建议

### 1. 动手实践
📝 **理论 30% + 实践 70%**
- 不要只看不做
- 每学完一个概念就动手实践
- 遇到问题是最好的学习机会

### 2. 循序渐进
🎯 **从简单到复杂**
- 先跑通示例代码
- 再尝试修改
- 最后独立开发

### 3. 记录笔记
📓 **建立自己的知识库**
- 记录遇到的问题和解决方案
- 整理常用代码片段
- 总结最佳实践

### 4. 参与社区
👥 **交流和分享**
- 加入 Discord 社区
- 分享你的项目
- 帮助其他学习者

### 5. 持续学习
🚀 **保持更新**
- 关注 MCP 协议更新
- 学习新的最佳实践
- 探索新的应用场景

---

## 🎉 开始你的学习之旅

现在就开始第一阶段的学习吧！

```bash
# 1. 克隆项目
git clone https://github.com/makenotion/notion-mcp-server.git
cd notion-mcp-server

# 2. 安装依赖
npm install

# 3. 开始学习
open MCP_SERVER_学习指南.md
```

**祝你学习愉快！记住：最好的学习方式就是动手实践！** 🚀

---

**有问题？** 查看 `MCP_快速参考手册.md` 或在社区提问！

