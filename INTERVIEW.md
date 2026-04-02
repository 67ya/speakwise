# 英语口语练习助手 — 面试技术文档

> 适用于技术面试、项目介绍、HR 问答全场景。建议先通读一遍，理解每个问题背后的逻辑，用自己的语言表达。

---

## 目录

1. [项目一句话介绍](#1-项目一句话介绍)
2. [完整技术栈](#2-完整技术栈)
3. [系统架构](#3-系统架构)
4. [数据库设计](#4-数据库设计)
5. [后端实现细节](#5-后端实现细节)
6. [前端实现细节](#6-前端实现细节)
7. [Redis 缓存策略](#7-redis-缓存策略)
8. [语音输入功能](#8-语音输入功能)
9. [响应式设计](#9-响应式设计)
10. [API 设计](#10-api-设计)
11. [AWS 部署方案](#11-aws-部署方案)
12. [项目亮点总结](#12-项目亮点总结)
13. [面试高频问题 & 参考回答](#13-面试高频问题--参考回答)
14. [Vibe Coding 相关问题](#14-vibe-coding-相关问题)

---

## 1. 项目一句话介绍

**一个帮助中国英语学习者练习口语的 AI 辅助 Web 应用。** 用户输入一段英语句子，AI 自动给出口语化改写、中文翻译、词汇解析和语法纠错；保存的句子存入个人笔记本，支持分类管理和优先级标记。前端支持语音输入，可直接用麦克风说话代替打字，界面同时适配桌面和手机。

---

## 2. 完整技术栈

| 层级 | 技术 | 版本 / 说明 |
|------|------|------------|
| 前端框架 | React | 19.x，函数组件 + Hooks |
| 前端语言 | TypeScript | 5.9，严格模式 |
| 前端构建 | Vite | 8.x，ESM 构建 |
| HTTP 客户端 | Axios | 1.x |
| 后端框架 | ASP.NET Core | .NET 8，Web API |
| 后端语言 | C# | 12，Primary Constructor 等新特性 |
| ORM | Entity Framework Core | 8.x + Pomelo.MySQL 驱动 |
| 数据库 | MySQL | 8.x，AWS RDS（生产） |
| 缓存 | Redis | StackExchange.Redis，AWS ElastiCache（生产） |
| AI 接口 | OpenAI 兼容 API | 模型：gpt-4o |
| 容器化 | Docker | 多阶段构建 |
| 云部署 | AWS | ECS Fargate + RDS + ElastiCache + S3 + CloudFront |
| CI/CD | GitHub Actions | 自动构建 → ECR → ECS 滚动更新 |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────────────┐
│                      用户浏览器 / 手机                 │
│                                                     │
│   React + TypeScript (Vite)                         │
│   ├── PracticeView  （练习页，语音输入）               │
│   ├── NotebookView  （笔记本，分类管理）               │
│   └── axios → http://127.0.0.1:8090               │
└──────────────────────┬──────────────────────────────┘
                       │ REST API (JSON)
                       ▼
┌─────────────────────────────────────────────────────┐
│              ASP.NET Core 8 Web API                  │
│                                                     │
│  AnalyzeController   → AiService                    │
│  EntriesController   → AppDbContext (EF Core)       │
│  CategoriesController→ AppDbContext (EF Core)       │
│                                                     │
│  ┌──────────────┐   ┌──────────────┐               │
│  │    MySQL      │   │    Redis      │               │
│  │  (EF Core)   │   │ (AI结果缓存)  │               │
│  └──────────────┘   └──────────────┘               │
│                            │                        │
│                    ┌───────▼──────┐                 │
│                    │  OpenAI API  │                 │
│                    │  (gpt-4o)   │                 │
│                    └─────────────┘                  │
└─────────────────────────────────────────────────────┘
```

**请求流程（以分析句子为例）：**
1. 用户在前端输入句子（或语音输入），点击「快速分析」
2. React 调用 `POST /api/analyze`，携带 `{ sentence, includeSpoken: false }`
3. `AnalyzeController` 调用 `AiService.AnalyzeAsync()`
4. AiService 先计算句子的 SHA256 哈希，查询 Redis 缓存
5. 缓存命中 → 直接返回，`fromCache: true`；未命中 → 调用 OpenAI API
6. OpenAI 返回结构化文本 → 解析为 `AnalyzeResult` 对象 → 存入 Redis（TTL 7天）
7. 前端展示结果，缓存命中时显示 ⚡ 提示

---

## 4. 数据库设计

### 表结构

**categories 表**
```sql
CREATE TABLE categories (
    Id   INT PRIMARY KEY AUTO_INCREMENT,
    Name VARCHAR(100) NOT NULL
);
```

**entries 表**
```sql
CREATE TABLE entries (
    Id          BIGINT PRIMARY KEY AUTO_INCREMENT,
    Question    VARCHAR(500),
    Original    VARCHAR(2000) NOT NULL,
    Spoken      VARCHAR(2000),
    Translation VARCHAR(2000),
    Analysis    TEXT,
    Corrections TEXT,
    Timestamp   DATETIME(6) NOT NULL,
    Color       VARCHAR(20),
    CategoryId  INT,
    FOREIGN KEY (CategoryId) REFERENCES categories(Id) ON DELETE SET NULL
);
```

### 设计决策

**Q: 为什么用 `BIGINT` 作为 Entry 的主键，而不是 `INT`？**
> 历史原因：项目原型用 `Date.now()` 生成 ID（13位时间戳），迁移时保留了这个设计。生产环境可改为 AUTO_INCREMENT INT，但 BIGINT 不会有溢出风险。

**Q: 为什么删除分类时 Entry 的 CategoryId 设为 NULL 而不是级联删除？**
> 笔记本内容是用户的核心数据，删除一个分类不应该丢失其下的句子。`ON DELETE SET NULL` 保证数据安全，前端通过"禁止删除有条目的分类"在应用层再加一道保护。

**Q: Analysis 和 Corrections 为什么用 TEXT 而不是 VARCHAR？**
> AI 返回的词汇解析和纠错内容可能很长（多条逐行列举），VARCHAR 的 64KB 上限在极端情况下可能不够，TEXT 更安全。

### EF Core 关键配置

```csharp
// AppDbContext.cs
modelBuilder.Entity<Entry>()
    .HasOne(e => e.Category)
    .WithMany(c => c.Entries)
    .HasForeignKey(e => e.CategoryId)
    .OnDelete(DeleteBehavior.SetNull);  // 分类删除时 Entry.CategoryId 置 null
```

**Q: 为什么用 `EnsureCreated()` 而不是 Migrations？**
> 开发阶段追求快速迭代，`EnsureCreated()` 在数据库不存在时自动建表，无需手动 `dotnet ef migrate`。生产部署前应替换为 `Migrate()`，支持版本化 Schema 变更，且不会丢失现有数据。

---

## 5. 后端实现细节

### 5.1 依赖注入架构

```csharp
// Program.cs 中的服务注册
builder.Services.AddDbContext<AppDbContext>(...)        // EF Core，Scoped
builder.Services.AddStackExchangeRedisCache(...)        // Redis，Singleton
builder.Services.AddHttpClient("AI")                   // IHttpClientFactory，Singleton
builder.Services.AddScoped<AiService>()                // AI服务，Scoped
```

**Q: 为什么 AiService 注册为 Scoped 而不是 Singleton？**
> AiService 依赖 `IDistributedCache`（分布式缓存）和 `IHttpClientFactory`，这两个本身是线程安全的。但 `IConfiguration` 和 `HttpClient` 的使用方式在 Scoped 下更符合 ASP.NET Core 的生命周期管理规范，避免潜在的请求上下文污染。

### 5.2 AI Prompt 工程

核心设计原则：**强制结构化输出**，用 `[TAG]` 标签包裹每个部分，方便后端解析。

```
[SPOKEN]         ← 仅完整分析模式有此节
[TRANSLATION]    ← 中文翻译
[ANALYSIS]       ← 词汇解析，每行一个
[CORRECTIONS]    ← 纠错，每行一个
```

**解析逻辑（`ParseResponse` 方法）：**
```csharp
static string GetSection(string content, string tag)
{
    var pattern = $"[{tag}]";
    var start = content.IndexOf(pattern);        // 找到标签位置
    start += pattern.Length;                      // 跳过标签本身
    var end = content.IndexOf('[', start);        // 找到下一个标签
    return (end < 0 ? content[start..] : content[start..end]).Trim();
}
```

**Q: 如果 AI 没有按格式输出怎么办？**
> `GetSection` 找不到标签时返回空字符串，前端 `renderBlock` 函数会过滤掉空内容。这是防御性编程的体现——不会崩溃，只是部分内容为空，用户会看到空白的某个分析节。更健壮的方案是加重试逻辑，但考虑到 gpt-4o 的格式遵从率很高，当前实现足够。

### 5.3 两种分析模式

| 模式 | `includeSpoken` | 内容 | 应用场景 |
|------|----------------|------|---------|
| 快速分析 | `false` | 翻译 + 词汇 + 纠错 | 只想快速检查语法 |
| 完整分析 | `true` | 口语改写 + 翻译 + 词汇 + 纠错 | 想学自然表达方式 |

两种模式对应不同的缓存 key 后缀（`:full` / `:quick`），互不干扰。

### 5.4 CORS 配置

```csharp
policy.WithOrigins(allowedOrigins)
      .AllowAnyHeader()
      .AllowAnyMethod()
```

允许的源写在 `appsettings.json` 的 `Cors:AllowedOrigins` 数组中，方便不同环境（开发/生产）配置不同域名，不需要改代码。

### 5.5 C# 现代特性应用

```csharp
// Primary Constructor（C# 12）
public class AiService(IHttpClientFactory httpClientFactory, IDistributedCache cache, IConfiguration config)

// Record 类型用于 DTO
public record EntryCreateDto(string? Question, string Original, ...);
public record ValueDto<T>(T Value);

// 范围运算符
return content[start..end].Trim();

// Raw String Literal（多行字符串）
var prompt = $"""
You are an English learning assistant...
""";
```

---

## 6. 前端实现细节

### 6.1 项目结构

```
src/
├── api/
│   ├── client.ts       # axios 实例，统一 baseURL 和 headers
│   ├── analyze.ts      # POST /api/analyze
│   ├── entries.ts      # CRUD /api/entries
│   └── categories.ts   # CRUD /api/categories
├── components/
│   ├── PracticeView.tsx  # 练习页（语音输入 + 提交 + 结果展示）
│   ├── NotebookView.tsx  # 笔记本（分类分组 + 详情面板）
│   ├── CategoryModal.tsx # 分类管理弹窗
│   └── Toast.tsx         # 轻提示组件
├── hooks/
│   ├── useToast.ts       # Toast 状态管理
│   └── useVoiceInput.ts  # Web Speech API 封装
├── types/
│   └── index.ts          # TypeScript 接口定义
├── App.tsx               # 路由（练习/笔记本 切换）
└── index.css             # 全局样式 + 响应式
```

### 6.2 状态管理策略

没有使用 Redux / Zustand 等状态管理库，原因是应用规模不大，组件层次浅，用 `useState` + `props` 传递已经足够清晰。

**数据流向：**
```
App.tsx
  ├── categories（全局数据，App 层加载，props 传给 PracticeView）
  ├── refreshSignal（数字信号，保存后 +1，触发 NotebookView 重新加载）
  └── showToast（全局提示，通过 props 传递）
```

**Q: 为什么不用 Context API 或状态管理库？**
> 应用只有两个主视图，数据关系简单。过度设计会增加代码复杂度。如果后续添加用户认证、多页面路由、跨组件共享状态等功能，可以引入 Zustand（轻量）或 React Query（处理服务端状态）。

### 6.3 TypeScript 类型设计

```typescript
// 核心接口
interface Entry {
  id: number;
  question?: string;       // 可选（某些笔记没有问题背景）
  original: string;
  spoken: string;
  translation: string;
  analysis: string;
  corrections: string;
  timestamp: string;       // ISO 8601 字符串
  color: string | null;    // null = 未标记
  categoryId: number | null;
}

// 分析结果（临时状态，保存前）
interface PendingEntry extends AnalyzeResult {
  question: string;
  original: string;
  includeSpoken: boolean;
}
```

**Q: `PendingEntry` 为什么 extends `AnalyzeResult`？**
> 用户分析完句子后，结果还没保存到数据库，是一个临时状态。它包含 AI 返回的所有字段（`AnalyzeResult`），加上用户输入的 `question`、`original` 和分析模式 `includeSpoken`。这样类型上明确区分了"已持久化的 Entry"和"待保存的临时结果"。

---

## 7. Redis 缓存策略

### 缓存 Key 设计

```
analyze:{SHA256(sentence)[前16位]}:{full|quick}
```

**示例：**
- 句子 `"I love autumn"` + 完整分析 → `analyze:A3F2B1C4D5E6F7A8:full`
- 句子 `"I love autumn"` + 快速分析 → `analyze:A3F2B1C4D5E6F7A8:quick`

**Q: 为什么用 SHA256 哈希而不是直接用句子作 key？**
> 两个原因：
> 1. Redis key 有长度限制，句子可能很长
> 2. 哈希后 key 格式统一、长度固定，便于管理和监控

**Q: 只取前 16 位会不会哈希碰撞？**
> SHA256 前 16 位（64位熵）的碰撞概率约为 2^-64，对于一个个人学习应用完全可以接受。如果是高并发生产系统，可以用完整 32 位哈希。

### 缓存生命周期

- **TTL：7 天**（`AbsoluteExpirationRelativeToNow = TimeSpan.FromDays(7)`）
- **理由：** AI 对同一个句子的分析结果是确定的，不需要频繁刷新。7 天平衡了缓存命中率和内存占用。
- **缓存失效策略：** 被动过期（TTL 到期自动删除），没有主动失效。

### 成本效益

每次调用 gpt-4o API 约 $0.002-0.01（取决于输入/输出 token 数）。Redis 缓存可以：
- 减少重复相同句子的 API 调用（同一句子在 7 天内只调用一次）
- 降低响应延迟（毫秒 vs 3-5 秒）
- 前端用 ⚡ 图标直观展示缓存命中

---

## 8. 语音输入功能

### 技术方案：Web Speech API（浏览器原生）

```typescript
// useVoiceInput.ts 核心逻辑
const SpeechRecognitionAPI =
  window.SpeechRecognition || window.webkitSpeechRecognition;

const recog = new SpeechRecognitionAPI();
recog.lang = 'en-US';
recog.interimResults = false;     // 只要最终结果，不要实时字幕
recog.maxAlternatives = 1;        // 只取最优候选
recog.onresult = (e) => {
  const transcript = e.results[0][0].transcript;
  onResult(transcript);
};
```

### 状态机

```
idle ──[点击麦克风]──→ listening ──[识别完成]──→ idle
 ↑                         │
 └────────[点击停止]────────┘
 ↑
unsupported（浏览器不支持时，麦克风按钮隐藏）
```

### 降级处理

```typescript
const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// state 初始化时检测支持性
useState<VoiceState>(SpeechRecognitionAPI ? 'idle' : 'unsupported')
```

**Q: 为什么用浏览器原生 API 而不是 Whisper API（后端语音识别）？**
> 1. **零成本：** Web Speech API 免费，Whisper API 按分钟收费
> 2. **低延迟：** 浏览器本地处理，无需上传音频文件
> 3. **简单：** 无需后端改动，不需要处理音频文件存储
> 4. **够用：** 用户练习英语口语，说的是标准英语，Web Speech API 识别率足够高
> 5. **局限性已接受：** 不支持 Firefox（仅支持 Chrome/Edge/Safari），但这个用户群体基本用 Chrome

### 用户体验细节

- 录音中：按钮变红 + 脉冲动画（CSS `@keyframes mic-pulse`）
- 识别结果追加到文本框（不覆盖，支持多次录音拼接）
- 识别完成或出错自动回到 idle 状态

---

## 9. 响应式设计

### 断点策略

单一断点：`640px`
- `>= 640px`：桌面布局
- `< 640px`：手机布局

### 练习页响应式

桌面和手机基本一致，差异在于：
- 内边距收窄（`padding: 16px 12px`）
- 按钮支持 `flex-wrap`（屏幕窄时换行）
- 字号略小

### 笔记本页：单面板切换模式

桌面（左右分栏）：
```
┌────────────┬──────────────────────┐
│  分类列表   │       详情面板         │
│  (310px)   │      (flex: 1)       │
└────────────┴──────────────────────┘
```

手机（单面板，CSS transform 动画）：
```
状态1：列表面板          状态2：详情面板
┌────────────────┐     ┌────────────────┐
│    分类列表     │  →  │    详情内容     │
│    (100%)      │     │  ← 返回列表     │
└────────────────┘     └────────────────┘
```

**实现方式：** 不是条件渲染，而是用 CSS `transform: translateX()` 实现滑动切换，性能更好（不触发 Layout，只触发 Composite）。

```css
/* 手机端 */
.nb-list { position: absolute; inset: 0; transform: translateX(0); }
.nb-list--hidden { transform: translateX(-100%); }

.nb-detail-wrap { position: absolute; inset: 0; transform: translateX(100%); }
.nb-detail-wrap--visible { transform: translateX(0); }
```

---

## 10. API 设计

### RESTful 端点总览

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/analyze` | AI 分析句子 |
| GET | `/api/entries` | 获取所有笔记（按时间降序） |
| POST | `/api/entries` | 创建新笔记 |
| PATCH | `/api/entries/{id}/color` | 更新颜色标记 |
| PATCH | `/api/entries/{id}/category` | 更新所属分类 |
| DELETE | `/api/entries/{id}` | 删除笔记 |
| GET | `/api/categories` | 获取所有分类 |
| POST | `/api/categories` | 创建分类 |
| PUT | `/api/categories/{id}` | 重命名分类 |
| DELETE | `/api/categories/{id}` | 删除分类（有条目时返回 400） |

### PATCH vs PUT

**Q: 为什么颜色和分类用 PATCH 而不是 PUT？**
> PUT 语义是替换整个资源，需要传所有字段。用 PUT 更新颜色就需要传完整的 Entry 对象，但其他字段（analysis、corrections 等 TEXT 字段）可能很大，浪费带宽。
> PATCH 表示局部更新，只传要改的字段，语义更准确，网络开销更小。

**Q: `ValueDto<T>` 这个泛型 DTO 是怎么工作的？**
```csharp
public record ValueDto<T>(T Value);
// 使用：PATCH body 为 { "value": "#F8BBD9" } 或 { "value": null }
```
> 因为颜色和分类都可以为 null（表示清除），用泛型 DTO 统一处理，不需要为每个 PATCH 端点单独定义 DTO 类。

### 错误处理

- 句子为空：`400 Bad Request { error: "Sentence is required" }`
- 分类有条目：`400 Bad Request { error: "该分类下还有 N 条记录" }`
- 资源不存在：`404 Not Found`
- AI 调用失败：`response.EnsureSuccessStatusCode()` 会抛出异常，ASP.NET Core 的异常中间件返回 `500`

---

## 11. AWS 部署方案

### 架构图

```
用户
 │
 ├──→ CloudFront CDN ──→ S3 Bucket（React 静态资源）
 │
 └──→ Application Load Balancer
              │
              ▼
        ECS Fargate（.NET Core Docker 容器）
              │
        ┌─────┴──────┐
        ▼             ▼
   RDS MySQL      ElastiCache Redis
   (t3.micro)      (t3.micro)
   私有子网         私有子网
```

### 关键配置

**ECS Task Definition 环境变量（替代 appsettings.json）：**
```
DB_CONNECTION_STRING   → AWS Parameter Store（加密）
REDIS_CONNECTION_STRING→ AWS Parameter Store（加密）
AI_API_KEY             → AWS Secrets Manager
AI_BASE_URL
AI_MODEL
```

**为什么 RDS 和 ElastiCache 放在私有子网？**
> 数据库不应直接暴露在公网。只有 ECS 容器（在同一 VPC 内）可以访问，外部攻击者无法直接连接 MySQL 或 Redis 端口。

### GitHub Actions CI/CD

**后端部署流程（`.github/workflows/deploy-backend.yml`）：**
```
push to main
  → dotnet build + test
  → docker build（多阶段构建）
  → docker push → ECR
  → aws ecs update-service（滚动更新，zero downtime）
```

**前端部署流程（`.github/workflows/deploy-frontend.yml`）：**
```
push to main
  → npm run build
  → aws s3 sync ./dist s3://bucket-name --delete
  → aws cloudfront create-invalidation（刷新 CDN 缓存）
```

### Docker 多阶段构建（示意）

```dockerfile
# 构建阶段
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY . .
RUN dotnet publish -c Release -o /app/publish

# 运行阶段（体积小 4-5x）
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "eng-learn.dll"]
```

---

## 12. 项目亮点总结

| 亮点 | 技术体现 | 面试角度 |
|------|---------|---------|
| AI 集成 | OpenAI API + Prompt 工程 | 会设计结构化 Prompt，能解析 AI 输出 |
| 缓存设计 | Redis + SHA256 Key + TTL | 懂缓存策略，能降低 API 成本 |
| 全栈 | React TS + .NET Core | 前后端都能做 |
| 语音输入 | Web Speech API | 了解浏览器原生 API，关注用户体验 |
| 响应式 | CSS transform 单面板切换 | 懂移动端布局，不依赖第三方组件库 |
| 数据库设计 | EF Core + 外键 + SetNull | 懂关系型数据库设计 |
| API 设计 | RESTful + PATCH 局部更新 | 懂 HTTP 语义 |
| 云部署 | AWS ECS + RDS + S3 + CDN | 有实际云部署经验 |
| CI/CD | GitHub Actions | 有自动化部署经验 |
| 类型安全 | TypeScript 严格模式 | 写有质量的前端代码 |

---

## 13. 面试高频问题 & 参考回答

### 项目整体

**Q: 能简单介绍一下这个项目吗？**
> 这是一个帮助我自己练习英语口语的工具。我说一句英语，AI 会告诉我这句话自然的说法是什么、中文意思、重点词汇，以及我哪里说错了。说的句子可以保存到笔记本按分类管理，方便复习。技术上用了 React + TypeScript 做前端，.NET Core C# 做后端，MySQL 存数据，Redis 缓存 AI 结果，支持手机访问，输入方式支持语音。

**Q: 这个项目做了多久，为什么做这个？**
> 从原型到现在的版本断断续续迭代了一段时间。最开始是纯 Node.js + HTML 的原型，后来想做成简历项目，重写成了 .NET Core 后端 + React 前端，并加上了 AWS 部署方案。做这个是因为自己在练习英语口语，需要一个能快速给反馈的工具。

---

### 后端问题

**Q: 为什么选 .NET Core 而不是 Node.js 或 Python？**
> 项目原型是 Node.js 写的。重构时选 .NET Core 是因为：
> 1. C# 是强类型语言，大型项目更容易维护
> 2. ASP.NET Core 的性能在 Web API 场景下很好（TechEmpower 基准测试排名靠前）
> 3. EF Core 的类型安全查询比 SQL 字符串拼接更安全
> 4. 想在简历上展示 .NET Core 的经验

**Q: EF Core 的 `EnsureCreated()` 和 `Migrate()` 有什么区别？**
> `EnsureCreated()` 直接根据当前 Model 创建表，不维护 Migration 历史，适合快速原型开发。`Migrate()` 使用 EF Core Migration 文件，支持增量 Schema 变更（加列、改列名等），不丢失数据，适合生产环境。目前用 `EnsureCreated()` 是因为还在开发阶段，上线前会切换为 `Migrate()`。

**Q: 你的 API Key 写在 appsettings.json 里，这样安全吗？**
> 在本地开发环境是可以的，生产环境绝对不能这样做。生产环境的做法是：把 API Key 存入 AWS Secrets Manager 或 Parameter Store，通过环境变量注入到 ECS Task，代码里通过 `Environment.GetEnvironmentVariable()` 或 ASP.NET Core 的配置系统读取，appsettings.json 里不包含任何密钥。同时 appsettings.json 应该加入 `.gitignore`，防止密钥被提交到代码仓库。

**Q: 你如何处理 AI API 调用失败的情况？**
> 目前用 `response.EnsureSuccessStatusCode()` 抛出异常，由 ASP.NET Core 的异常处理中间件返回 500 错误，前端 catch 到后显示 Toast 提示。更完善的方案是：1）加指数退避重试（比如最多重试 3 次）；2）区分不同错误类型（网络错误 vs API 限流 vs 内容安全拒绝），给用户不同的提示；3）加超时设置（当前没有设置 `HttpClient.Timeout`）。

**Q: IHttpClientFactory 和直接 new HttpClient() 有什么区别？**
> 直接 `new HttpClient()` 有两个已知问题：一是 HttpClient 用完应该复用而不是频繁创建/销毁（每次创建会占用 socket），二是 DNS 变更后旧 HttpClient 不会刷新（socket exhaustion 和 DNS 缓存问题）。`IHttpClientFactory` 由 DI 容器管理，自动处理 HttpMessageHandler 的生命周期和连接池，是 .NET Core 的推荐做法。

---

### 前端问题

**Q: 为什么选 Vite 而不是 Create React App？**
> Create React App 已经不再积极维护，且基于 Webpack 构建速度较慢。Vite 基于 ES Module 原生支持，开发服务器启动时间在毫秒级（不需要打包整个项目），HMR 也更快。Vite 现在是 React 生态的推荐工具。

**Q: 你的前端没有用任何 UI 组件库，为什么？**
> 这个项目的 UI 比较简单，用组件库会引入额外的包体积（Ant Design 压缩后约 500KB）。自己写 CSS 可以完全控制样式，响应式逻辑也更灵活。对于更大的应用或团队项目，使用 shadcn/ui 或 Ant Design 是合理的。

**Q: React 的 `useCallback` 你在哪里用了，为什么？**
> 在 `PracticeView` 里传给 `useVoiceInput` 的回调函数：
> ```typescript
> const onSentenceVoice = useCallback((text: string) => {
>   setSentence(prev => prev ? prev + ' ' + text : text);
> }, []);
> ```
> 不用 `useCallback` 的话，每次 PracticeView 重渲染都会生成一个新的函数对象，传给 `useVoiceInput` 的 `onResult` 会变化，触发 `useCallback` 内部的依赖更新，导致 `SpeechRecognition.onresult` 每次都重新绑定。用 `useCallback` + 空依赖数组保证函数引用稳定。

**Q: `useVoiceInput` 为什么用 `useRef` 存 recognition 对象？**
> `useRef` 存的值在重渲染之间保持稳定，且修改它不会触发重渲染。`SpeechRecognition` 实例需要在 `stop()` 时访问，如果放在 `useState` 里，`stop` 函数通过闭包捕获的可能是旧值（stale closure 问题）。`useRef` 是 React 中存"副作用对象"的标准做法。

---

### 数据库问题

**Q: 什么情况下会选择 MySQL 而不是 PostgreSQL？**
> 两者功能上都足够满足这个项目。选 MySQL 主要是因为 AWS RDS MySQL 的 t3.micro 免费套餐，以及 Pomelo.MySQL 这个 EF Core 驱动成熟稳定。如果需要更复杂的查询（JSONB、全文搜索、窗口函数等），PostgreSQL 的实现更完善，那时候会考虑切换。

**Q: 这个项目有 N+1 查询问题吗？**
> `GET /api/entries` 目前返回的是 `Entries` 表数据，没有 Include Category 导航属性，所以没有 N+1 问题。如果前端需要在列表里显示分类名称，就需要 `db.Entries.Include(e => e.Category).ToListAsync()`，这是一次 JOIN 查询，依然是 1 条 SQL，不是 N+1。

---

### 架构问题

**Q: 如果用户量增长，这个架构的瓶颈在哪里？**
> 1. **AI API 调用：** OpenAI API 有 RPM（每分钟请求数）限制，Redis 缓存可以缓解，但高并发下仍是瓶颈。解决方案：请求队列（比如用 AWS SQS）+ 流式响应（SSE）。
> 2. **ECS 单实例：** 目前是单容器，可以配置 ECS Auto Scaling，根据 CPU/内存自动扩缩容，ALB 负载均衡。
> 3. **RDS 单节点：** 可以添加 Read Replica 分担读流量，或升级到 Aurora MySQL 支持自动扩缩容。
> 4. **这个项目本身是单用户设计**，没有用户认证，不适合直接公开部署，需要先加 Auth。

**Q: 如果要加用户认证，你会怎么做？**
> 推荐方案：用 AWS Cognito 或 Auth0 作为 Identity Provider，前端用 OAuth 2.0 / OIDC 流程登录，拿到 JWT Token 后每个请求在 `Authorization: Bearer` 头中携带。后端 ASP.NET Core 用 `[Authorize]` 特性保护 API，通过 `HttpContext.User` 获取当前用户 ID，数据库 Entry 和 Category 表加 `UserId` 字段实现数据隔离。

---

### 代码质量问题

**Q: 你的代码有哪些可以改进的地方？**
> 诚实地说，至少有这几点：
> 1. `appsettings.json` 里有明文 API Key，生产环境需要迁移到 Secrets Manager
> 2. AI 调用没有重试机制和超时设置
> 3. 前端没有全局错误边界（React Error Boundary），某个组件崩溃可能导致整个页面白屏
> 4. 没有任何单元测试或集成测试
> 5. `EnsureCreated()` 需要在生产前替换为 `Migrate()`
> 6. Entry 的 ID 用 BIGINT 是历史遗留，新项目应该用 AUTO_INCREMENT INT 或 GUID

**Q: 你写了哪些测试？**
> 目前这个项目没有写测试，是我的一个明显不足。如果要加，后端优先级：1）`AiService.ParseResponse` 的单元测试（用固定的 AI 输出字符串验证解析结果）；2）Controller 的集成测试（用 `WebApplicationFactory` + SQLite 内存数据库）。前端优先级：1）`useVoiceInput` hook 的单元测试（mock `SpeechRecognition`）；2）组件的渲染测试（React Testing Library）。

---

## 14. Vibe Coding 相关问题

### 什么是 Vibe Coding

**Vibe Coding** 是 OpenAI 联合创始人 Andrej Karpathy 在 2025 年初提出的概念，指完全用自然语言指令驱动 AI（如 Claude、GPT-4、Cursor）来生成代码，开发者主要负责提需求、审查效果、调整方向，而不是逐行手写代码。

### Q: 这个项目是 Vibe Coding 做的吗？你怎么看待这种开发方式？

> 这个项目大量使用了 Claude Code（AI 辅助编程工具）来生成代码。我会描述需求和技术选型，AI 生成具体实现，我审查代码逻辑、测试功能、指出问题让 AI 修改。
>
> 我对这种方式的看法：
> - **优势：** 大幅提升了开发速度，特别是样板代码（CRUD、DTO、CSS 布局）；让我能在更短时间内尝试更多技术（比如 .NET Core 对我来说是新的）
> - **风险：** AI 会生成看起来正确但有细节问题的代码（比如 `EnsureCreated()` vs `Migrate()` 的区别，需要你懂才能发现）；对整体架构的把控还是需要开发者自己
> - **我的角色：** 我主导了技术选型、系统架构、数据库设计、API 设计，AI 负责生成具体实现。遇到问题时我能读懂代码、定位错误，这说明我真正理解了代码而不是盲目使用

### Q: 用 AI 生成的代码，你真的理解它吗？

> 理解。我能解释每个文件的作用、每个技术决策的原因，也能在运行出错时定位问题（比如 TypeScript 编译报错、Windows 端口被占用等）。
>
> AI 工具更像一个效率很高的结对编程伙伴——它打字比我快，但它不了解我的项目背景，需要我持续提供上下文和验证。如果我只是复制粘贴代码而不理解，遇到任何问题都无法解决，项目根本跑不起来。

### Q: AI 写代码会不会导致程序员失业？

> 我认为短期内不会，但工作内容会转变。AI 善于生成样板代码、实现已有模式，但在以下方面还需要人类：
> - 理解模糊的业务需求，转化为准确的技术规格
> - 在多个技术方案之间权衡取舍（考虑团队能力、长期维护成本等）
> - 处理复杂的系统集成问题（比如生产环境的权限配置、网络问题）
> - 调试 AI 自己产生的 bug
> - 对代码的安全性和性能负责
>
> 更准确地说，会用 AI 工具的工程师会比不用 AI 的工程师效率高很多，竞争优势在于会不会用 AI，而不是会不会写代码。

### Q: 你在使用 AI 编程时踩过什么坑？

> 踩过几个典型的坑：
> 1. **AI 生成了能运行但有安全隐患的代码：** 比如明文 API Key 写在配置文件里，AI 没有主动提醒，需要我自己意识到
> 2. **AI 对上下文有限制：** 跨多个文件的重构任务，AI 有时会遗漏某个地方，比如更新了 DTO 但忘记更新对应的 Controller 逻辑
> 3. **AI 会自信地说错话：** 比如某个 Windows 网络权限问题，AI 给出了几个方向，需要我自己验证哪个是真正的原因
> 4. **AI 生成的代码风格不统一：** 不同时间生成的代码可能用不同的写法，需要人工统一
>
> 解决方式：对 AI 生成的代码保持批判性审查，特别是涉及安全（认证、密钥管理）和数据操作（删除、事务）的部分一定要自己看清楚。

### Q: 你认为 AI 辅助编程会怎样影响初级程序员的成长？

> 这是个两面性的问题。
> - **正面影响：** 初级程序员可以通过 AI 快速接触到更多技术（比如我用 AI 帮助我上手了之前不熟悉的 .NET Core），AI 也能在你学习过程中即时解答问题，像一个 24 小时可用的导师
> - **风险：** 如果过度依赖 AI 而不理解背后的原理，遇到 AI 解决不了的问题（调试复杂 bug、性能优化、系统设计）时会暴露出知识空白
>
> 我的建议（也是我对自己的要求）：用 AI 提速，但确保能读懂并解释每一行生成的代码，遇到不理解的概念先弄懂再继续。

---

## 附录：快速问答卡片

| 问题 | 一句话答案 |
|------|----------|
| 项目用了什么数据库？ | MySQL（本地/AWS RDS），EF Core ORM |
| Redis 做什么的？ | 缓存 AI 分析结果，TTL 7 天，同一句子只调用一次 API |
| 前端框架？ | React 19 + TypeScript 5，Vite 构建 |
| 后端框架？ | ASP.NET Core 8，C# 12 |
| 语音输入怎么实现的？ | 浏览器原生 Web Speech API，`SpeechRecognition` |
| 响应式怎么做的？ | 单断点 640px，手机端笔记本用 CSS transform 单面板切换 |
| 为什么用 PATCH 而不是 PUT？ | 局部更新，只传要改的字段，语义更准确 |
| AI 调用失败怎么处理？ | 抛异常 → 500 → 前端 Toast 提示（待改进：加重试） |
| 生产环境 API Key 怎么存？ | AWS Secrets Manager + ECS 环境变量注入 |
| 有没有写测试？ | 没有（诚实回答），知道该测什么和怎么测 |
