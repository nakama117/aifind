# AIFIND

面向日本读者的全球 AI 日文资讯站。基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 的开源框架与 MIT 许可证，使用独立品牌。

当前交付：本地功能候选版、源码部署包和独立内容快照。生产尚未上线；已使用真实 OpenAI 流水线处理六个官方来源，备有 146 篇日文资讯及 60 份报表。后台支持文章分页、筛选、修稿与撤稿；新增榜单运营入口及 SEO 配置诊断。实际接通范围和验收边界见下方交付记录。

- 日文资讯流、精选、分类、搜索、收藏、热点、日报/周报/月报、RSS、公开 API、Agent Markdown 与 MCP；中文管理后台。
- 模型排行榜、Codex 重置监控、主题大事记，恢复自上游公开历史实现并适配当前模块体系；真实运营数据另行导入。
- Node.js 24、React Router、Fastify、PostgreSQL 17、pg-boss、Docker Compose 与 Caddy。
- 默认 OpenAI GPT-6 Luna / text-embedding-3-small；请求回执、两次独立评分、预算告警与持久费用暂停。
- UTC 存储，日本时间显示；来源默认只发布短摘要与原文链接，未完成使用条件核验的来源保持停用。

## 入口

- [本地预览、部署、备份与恢复](docs/operations-zh.md)
- [后台内容管理与 SEO 操作](docs/admin-and-seo-zh.md)
- [最新功能、后台与 SEO 验证](docs/verification-completion-20261004.md)
- [首批真实内容验证记录](docs/verification-launch-20261004.md)
- [首批来源核验](docs/source-review.md)
- [100 条候选与人工评测说明](docs/evaluation-ja.md)
- [上游架构](docs/architecture.md) · [定制指南](docs/customize.md) · [精选规则](docs/selection.md)

## 现有完整内容预览

本工作区已有运行中的本地 PostgreSQL 和真实内容库。重启网站：

```sh
npm run build -w @aihot/web
node scripts/serve-local.ts --database postgres://postgres@127.0.0.1:55432/aisignal_launch
```

打开 http://127.0.0.1:3100 。启动器读取本地 `.env` 的后台配置，仅服务已有内容，关闭自动采集和模型调用。新服务器先导入独立内容快照，见运营手册。

## 不带内容快照的最小预览

先准备 Node 24.11+ 与本机 PostgreSQL 17。在项目目录：

```sh
npm ci
node scripts/init-env.ts
npm run build -w @aihot/web
node --env-file-if-exists=.env scripts/preview.ts --database postgres://postgres@127.0.0.1:5432/aisignal_preview
```

打开 http://127.0.0.1:3100 。预览强制关闭采集和模型调用，不需要 OpenAI Key。实际工作区 PostgreSQL 端口为 55432，详情见运营手册。

## 开发检查

```sh
npm run typecheck
# DATABASE_URL 指向名字以 _test 或 _ci 结尾的独立测试库
npm test
npm run build -w @aihot/web
node --test apps/web/tests/*.test.ts
node scripts/smoke.ts --base http://127.0.0.1:3100
```

用户已授权 Default project 专用 OpenAI 密钥，本站应用层每月 $8 上限；共享项目平台额度没有修改。生产前仍需域名与运营联系方式、来源/条款确认、人工日文质量验收、Linux Docker 验证、异地备份及真实 72 小时受限试运行。
