# Bundle 详情

[English](BUNDLES.md) | [中文](BUNDLES.zh.md)

每个 bundle 包含的 agent 和 skill 完整列表。

<details>
<summary><b>global</b> — 栈无关基础</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | planner | 复杂功能与重构的规划专家 |
| agent | architect | 系统设计、可扩展性与技术决策 |
| agent | code-architect | 基于代码库模式设计功能架构蓝图 |
| agent | code-explorer | 追踪执行路径、映射架构层次 |
| agent | code-reviewer | 代码质量、安全性与可维护性审查 |
| agent | code-simplifier | 在保持行为的前提下简化代码 |
| agent | comment-analyzer | 分析代码注释的准确性与腐化风险 |
| agent | silent-failure-hunter | 查找被吞掉的错误、错误回退、缺失传播 |
| agent | tdd-guide | 测试驱动开发方法论执行 |
| agent | type-design-analyzer | 分析类型设计的封装性与不变量 |
| agent | performance-optimizer | 性能瓶颈识别与优化 |
| agent | pr-test-analyzer | PR 测试覆盖质量审查 |
| agent | doc-updater | 文档与 codemap 维护 |
| agent | docs-lookup | 通过 Context7 MCP 查找库/框架文档 |
| agent | harness-optimizer | Agent harness 配置调优 |
| agent | refactor-cleaner | 死代码清理与整合 |
| skill | coding-standards | 跨项目编码规范：命名、可读性、不变性 |
| skill | api-design | REST API 模式：资源、状态码、分页、版本控制 |
| skill | tdd-workflow | 先写测试方法论，80%+ 覆盖率 |
| skill | verification-loop | Claude Code 会话综合验证 |
| skill | plankton-code-quality | 每次文件编辑自动格式化与 lint |
| skill | strategic-compact | 在逻辑节点手动压缩上下文 |
| skill | git-workflow | 分支策略、commit 规范、merge vs rebase |
| skill | gateguard | 每文件事实验证门控，编辑前强制调查（+2.25 质量） |
| skill | architecture-decision-records | 将架构决策记录为结构化 ADR 文档 |

</details>

<details>
<summary><b>java-proj</b> — Spring Boot</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | java-reviewer | Java/Spring Boot 代码审查：分层架构、JPA、安全、并发 |
| agent | java-build-resolver | 修复 Maven/Gradle 构建错误与依赖问题 |
| skill | springboot-patterns | Spring Boot 架构、REST API、数据访问、缓存、异步 |
| skill | springboot-tdd | JUnit 5、Mockito、MockMvc、Testcontainers 的 TDD |
| skill | springboot-verification | 构建、静态分析、测试、安全扫描 |
| skill | java-coding-standards | Java 命名、不变性、Optional、流、异常 |
| skill | jpa-patterns | JPA/Hibernate 实体设计、查询、事务、索引 |
| skill | springboot-security | Spring Security 认证/授权、CSRF、校验、限流 |

</details>

<details>
<summary><b>py-proj</b> — Python</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | python-reviewer | PEP 8、类型提示、Pythonic 风格、安全审查 |
| skill | python-patterns | Pythonic 风格、类型提示与最佳实践 |
| skill | python-testing | pytest、TDD、fixture、mock、参数化、覆盖率 |

</details>

<details>
<summary><b>py-django-proj</b> — Django（继承 py-proj）</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | django-patterns | 架构、DRF、ORM、缓存、信号、中间件 |
| skill | django-tdd | pytest-django、factory_boy、覆盖率 |
| skill | django-verification | 迁移、lint、测试、安全扫描 |
| skill | django-security | 认证、CSRF、SQL 注入防护、安全部署 |

</details>

<details>
<summary><b>py-ml-proj</b> — ML / 深度学习（继承 py-proj）</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | pytorch-build-resolver | 修复 tensor 形状不匹配、CUDA 错误、梯度问题 |
| skill | pytorch-patterns | 训练流水线、模型架构、数据加载 |

</details>

<details>
<summary><b>ts-backend-proj</b> — TypeScript/JS 后端</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | typescript-reviewer | 类型安全、异步正确性、Node/Web 安全审查 |
| agent | build-error-resolver | 最小改动修复构建/类型错误 |
| skill | backend-patterns | 后端架构、API 设计、数据库优化（Node.js/Express） |

</details>

<details>
<summary><b>ts-frontend-proj</b> — TypeScript/JS 前端</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | typescript-reviewer | 类型安全、异步正确性、Node/Web 安全审查 |
| agent | build-error-resolver | 最小改动修复构建/类型错误 |
| agent | e2e-runner | Vercel Agent Browser / Playwright E2E 测试 |
| skill | frontend-patterns | React、Next.js、状态管理、性能、UI 最佳实践 |
| skill | frontend-design | 高设计质量的生产级前端界面 |
| skill | e2e-testing | Playwright 模式、Page Object Model、CI/CD、flaky test 策略 |
| skill | nextjs-turbopack | Next.js 16+ Turbopack 增量打包配置 |

</details>

<details>
<summary><b>ts-nestjs-proj</b> — NestJS（继承 ts-backend-proj）</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | nestjs-patterns | 模块、控制器、Provider、DTO 校验、守卫、拦截器 |

</details>

<details>
<summary><b>nuxt-proj</b> — Nuxt（继承 ts-frontend-proj）</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | nuxt4-patterns | 水合安全、路由规则、SSR 安全数据获取 |

</details>

<details>
<summary><b>go-proj</b> — Go</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | go-reviewer | 地道 Go、并发、错误处理、性能审查 |
| agent | go-build-resolver | 修复 go build 错误、vet 问题、linter 警告 |
| skill | golang-patterns | 地道 Go 模式与约定 |
| skill | golang-testing | 表驱动测试、子测试、基准测试、模糊测试、覆盖率 |

</details>

<details>
<summary><b>rust-proj</b> — Rust</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | rust-reviewer | 所有权、生命周期、错误处理、unsafe 审查 |
| agent | rust-build-resolver | 修复 cargo build、借用检查器、Cargo.toml 问题 |
| skill | rust-patterns | 地道 Rust、所有权、trait、并发 |
| skill | rust-testing | 单元/集成测试、异步测试、属性测试 |

</details>

<details>
<summary><b>kotlin-proj</b> — Kotlin / Android / KMP</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | kotlin-reviewer | Kotlin 风格、协程安全、Compose、Clean Architecture |
| agent | kotlin-build-resolver | 修复 Kotlin/Gradle 构建与编译错误 |
| skill | kotlin-patterns | Kotlin 惯用法、协程、空安全、DSL 构建器 |
| skill | kotlin-testing | Kotest、MockK、协程测试、属性测试 |
| skill | kotlin-coroutines-flows | 结构化并发、Flow 操作符、StateFlow、错误处理 |
| skill | kotlin-exposed-patterns | JetBrains Exposed ORM：DSL、DAO、HikariCP、Flyway |
| skill | kotlin-ktor-patterns | Ktor 路由、插件、认证、Koin DI、WebSocket |
| skill | android-clean-architecture | Android/KMP Clean Architecture：模块、UseCase、Repository |
| skill | compose-multiplatform-patterns | Compose Multiplatform：状态、导航、主题、性能 |

</details>

<details>
<summary><b>cpp-proj</b> — C++</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | cpp-reviewer | 内存安全、现代 C++ 惯用法、并发、性能 |
| agent | cpp-build-resolver | 修复 CMake、编译、链接、模板错误 |
| skill | cpp-coding-standards | C++ 核心准则：现代、安全、地道的实践 |
| skill | cpp-testing | GoogleTest、CTest、sanitizer、覆盖率 |

</details>

<details>
<summary><b>csharp-proj</b> — C# / .NET</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | csharp-reviewer | .NET 约定、异步模式、可空引用、安全审查 |
| skill | dotnet-patterns | 地道 C#、DI、async/await、.NET 最佳实践 |
| skill | csharp-testing | xUnit、FluentAssertions、mock、集成测试 |

</details>

<details>
<summary><b>swift-proj</b> — Swift / iOS / macOS</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | swiftui-patterns | @Observable、视图组合、导航、性能优化 |
| skill | swift-concurrency-6-2 | Swift 6.2 默认单线程、@concurrent、隔离 |
| skill | swift-actor-persistence | 基于 Actor 的线程安全数据持久化 |
| skill | swift-protocol-di-testing | 基于协议的 DI 实现可测试代码 |
| skill | liquid-glass-design | iOS 26 Liquid Glass 动态材质与变形 |
| skill | foundation-models-on-device | Apple FoundationModels 端侧 LLM（iOS 26+） |

</details>

<details>
<summary><b>dart-flutter-proj</b> — Dart / Flutter</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | dart-build-resolver | 修复 dart analyze 错误、pub 冲突、build_runner 问题 |
| agent | flutter-reviewer | Widget 最佳实践、状态管理、无障碍审查 |
| skill | dart-flutter-patterns | 空安全、异步组合、Widget 架构、GoRouter、Dio |
| skill | flutter-dart-code-review | 库无关的 Flutter/Dart 审查清单 |

</details>

<details>
<summary><b>laravel-proj</b> — Laravel / PHP</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | laravel-patterns | 路由、Eloquent ORM、服务层、队列、事件、缓存 |
| skill | laravel-tdd | PHPUnit/Pest TDD、工厂、数据库测试 |
| skill | laravel-verification | 环境检查、lint、静态分析、测试、安全扫描 |
| skill | laravel-security | 认证、校验、CSRF、批量赋值、文件上传、密钥 |
| skill | laravel-plugin-discovery | 通过 LaraPlugins.io 发现和评估 Laravel 包 |

</details>

<details>
<summary><b>perl-proj</b> — Perl</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | perl-patterns | 现代 Perl 5.36+ 惯用法与约定 |
| skill | perl-testing | Test2::V0、prove 运行器、mock、Devel::Cover |
| skill | perl-security | taint 模式、DBI 参数化查询、Web 安全 |

</details>

<details>
<summary><b>ai-app-dev</b> — Claude API / MCP</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | claude-api | Messages API、流式、工具调用、视觉、思考、批量、缓存 |
| skill | mcp-server-patterns | 构建 MCP 服务器：工具、资源、Zod、stdio vs HTTP |
| skill | cost-aware-llm-pipeline | LLM 成本优化：模型路由、预算追踪、缓存 |

</details>

<details>
<summary><b>security</b> — 安全加固</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | security-reviewer | SSRF、注入、不安全加密、OWASP Top 10 检测 |
| skill | security-review | 安全漏洞审查 |
| skill | security-scan | 扫描 .claude/ 配置中的错误配置与注入风险 |
| skill | security-bounty-hunter | 主动挖掘可提交赏金的可利用漏洞 |

</details>

<details>
<summary><b>database</b> — 数据库</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | database-reviewer | PostgreSQL 查询优化、Schema 设计、安全 |
| skill | database-migrations | 跨 ORM 的 Schema 变更、回滚、零停机部署 |
| skill | postgres-patterns | PostgreSQL 索引、查询优化、Supabase 最佳实践 |
| skill | clickhouse-io | ClickHouse 分析、查询优化、数据工程 |

</details>

<details>
<summary><b>devops</b> — 部署与基础设施</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | docker-patterns | Docker/Compose：容器安全、网络、多服务编排 |
| skill | deployment-patterns | CI/CD 流水线、健康检查、回滚、生产就绪检查 |
| skill | benchmark | 性能基线、回归检测、技术栈对比 |

</details>

<details>
<summary><b>healthcare</b> — 医疗 / 临床</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | healthcare-reviewer | 临床安全、PHI 合规、医疗数据完整性 |
| skill | healthcare-cdss-patterns | 药物交互检查、剂量验证、临床评分 |
| skill | healthcare-emr-patterns | EMR/EHR 工作流、处方生成、临床决策支持 |
| skill | healthcare-eval-harness | 患者安全评估：CDSS 准确性、PHI 暴露测试 |
| skill | healthcare-phi-compliance | PHI/PII 分类、访问控制、审计追踪、加密 |
| skill | hipaa-compliance | HIPAA 隐私/安全：覆盖实体、BAA、违规态势 |

</details>

<details>
<summary><b>opensource</b> — 开源发布</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | opensource-forker | Fork、清除密钥/凭证、清理 git 历史 |
| agent | opensource-packager | 生成 CLAUDE.md、README、LICENSE、CONTRIBUTING、setup.sh |
| agent | opensource-sanitizer | 发布前扫描泄露的密钥、PII、内部引用 |
| skill | opensource-pipeline | 端到端 fork → 脱敏 → 打包流水线 |

</details>

<details>
<summary><b>a11y</b> — 无障碍</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | a11y-architect | WCAG 2.2 Web 和原生平台合规 |
| skill | accessibility | 设计、实现和审计包容性数字产品 |

</details>

<details>
<summary><b>seo</b> — SEO</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | seo-specialist | 技术 SEO 审计、Core Web Vitals、结构化数据 |
| skill | seo | 审计并实施 SEO 改进、Schema 标记、sitemap |

</details>

<details>
<summary><b>gan-harness</b> — GAN 对抗生成</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | gan-evaluator | 通过 Playwright 测试在线应用、按评分标准打分 |
| agent | gan-generator | 按规格实现功能、根据评估者反馈迭代 |
| agent | gan-planner | 将一句话提示扩展为完整产品规格与迭代计划 |
| skill | gan-style-harness | 生成器-评估器 agent harness 模式 |

</details>

<details>
<summary><b>agent-dev</b> — AI agent 开发</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | loop-operator | 运行自主循环、监控进度、卡住时介入 |
| skill | agentic-engineering | 评估优先执行、任务分解、成本感知模型路由 |
| skill | autonomous-agent-harness | 持久记忆、定时操作、计算机使用、任务队列 |
| skill | autonomous-loops | 从顺序管道到 RFC 驱动的多 agent DAG |
| skill | continuous-agent-loop | Agent 循环的质量门、评估与恢复控制 |
| skill | agent-harness-construction | 设计动作空间、工具定义、观察格式 |
| skill | agent-introspection-debugging | 自调试：捕获、诊断、受控恢复 |
| skill | eval-harness | 评估驱动开发的形式化评估框架 |
| skill | enterprise-agent-ops | 可观测性、安全边界、生命周期管理 |
| skill | dmux-workflows | 通过 dmux（tmux 窗格管理器）多 agent 编排 |
| skill | santa-method | 两个独立审查 agent 都必须通过才能发布 |
| skill | council | 四声部委员会处理模糊决策与权衡 |
| skill | team-builder | 交互式 agent 选择器，组建并行团队 |
| skill | ralphinho-rfc-pipeline | RFC 驱动的多 agent DAG，带质量门与合并队列 |
| skill | safety-guard | 防止自主 agent 运行时的破坏性操作 |

</details>

<details>
<summary><b>research</b> — 调研与分析</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | deep-research | 通过 firecrawl 和 exa 的多源网络调研（带引用） |
| skill | exa-search | 通过 Exa MCP 进行网络、代码、公司、人物的神经搜索 |
| skill | market-research | 竞争分析、市场规模、行业情报 |
| skill | research-ops | 基于公开证据和本地上下文的现状调研 |

</details>

<details>
<summary><b>content</b> — 内容创作</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | article-writing | 文章、指南、博客、教程、新闻稿 |
| skill | brand-voice | 从真实帖子构建写作风格档案并跨内容复用 |
| skill | content-engine | X、LinkedIn、TikTok、YouTube、newsletter 的平台原生内容 |
| skill | crosspost | 多平台分发，按平台适配（绝不复制粘贴） |
| skill | frontend-slides | 从零或 PPT 转换创建动画丰富的 HTML 演示 |
| skill | manim-video | Manim 动画解释器：概念、图表、系统架构 |
| skill | video-editing | 完整流水线：原始素材 → FFmpeg → Remotion → ElevenLabs → 精修 |
| skill | remotion-video-creation | React 中的 Remotion 视频创作（3D、动画、字幕） |
| skill | fal-ai-media | 通过 fal.ai MCP 生成图片/视频/音频 |
| skill | videodb | 视频/音频的摄入、索引、搜索、编辑、生成 |
| skill | ui-demo | 使用 Playwright 录制精美 UI 演示视频 |
| skill | investor-materials | 路演材料、一页纸、备忘录、财务模型 |
| skill | investor-outreach | 融资冷邮件、暖介绍、跟进 |

</details>

<details>
<summary><b>ops</b> — 业务运营</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| agent | chief-of-staff | 邮件/Slack/LINE/Messenger 分流与四级分类 |
| agent | conversation-analyzer | 分析对话记录，发现值得用 hook 预防的行为 |
| skill | email-ops | 邮箱分流、起草、发送验证、跟进 |
| skill | messages-ops | 读取消息/DM、恢复一次性验证码、检查会话 |
| skill | google-workspace-ops | Drive/Docs/Sheets/Slides：查找、编辑、迁移、清理 |
| skill | unified-notifications-ops | 跨 GitHub/Linear/桌面的告警路由、去重、升级 |
| skill | knowledge-ops | 知识库管理、摄入、同步、检索 |
| skill | project-flow-ops | GitHub/Linear issue 分流、PR 管理、待办控制 |
| skill | jira-integration | Jira 工单获取、状态更新、流转（MCP/REST） |
| skill | github-ops | Issue/PR/CI/Release 管理与自动化（gh CLI） |
| skill | terminal-ops | 运行命令、调试 CI 失败、带证据推送窄修复 |
| skill | automation-audit-ops | 盘点 job/hook/连接器，找出损坏/冗余的自动化 |
| skill | finance-billing-ops | 营收快照、定价对比、重复收费诊断 |
| skill | customer-billing-ops | 订阅、退款、流失分析（通过 Stripe） |

</details>

<details>
<summary><b>crypto</b> — Web3 / DeFi</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | defi-amm-security | Solidity AMM 安全：重入、预言机操纵、滑点 |
| skill | evm-token-decimals | 防止 EVM 链上的 decimal 不匹配 bug |
| skill | llm-trading-agent-security | 交易 agent 的提示注入、花费限额、熔断器 |
| skill | nodejs-keccak256 | Node sha3-256 ≠ 以太坊 Keccak-256——防止静默哈希 bug |

</details>

<details>
<summary><b>scan</b> — 临时评估（attach/detach）</summary>

| 类型 | 名称 | 说明 |
|---|---|---|
| skill | agent-sort | 基于证据的 ECC 安装计划：DAILY vs LIBRARY 分桶 |
| skill | skill-stocktake | 审计 skill 和 command 质量（快扫 / 全盘点） |
| skill | repo-scan | 跨栈源码审计，四级评定 |
| skill | workspace-surface-audit | 审计 repo、MCP 服务器、插件、环境，推荐 ECC 设置 |
| skill | ecc-tools-cost-audit | 审计 ECC Tools 消耗：PR 创建、配额、高级模型泄漏 |
| skill | rules-distill | 从 skill 中提取横切原则，精炼为 rule |
| skill | agent-eval | Coding agent 对比评测（通过率、成本、时间） |
| skill | skill-comply | 可视化 skill/rule 是否被实际遵循 |
| skill | codebase-onboarding | 分析陌生代码库，生成入门指南 + CLAUDE.md |
| skill | configure-ecc | 交互式 ECC 安装向导 |
| skill | context-budget | 审计 context window 消耗，找出膨胀点，推荐节省 |

</details>
