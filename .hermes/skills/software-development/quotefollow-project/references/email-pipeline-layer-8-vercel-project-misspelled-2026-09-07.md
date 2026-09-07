# 第八层：Vercel 项目名拼写错误导致 API 404（2026-09-07 实机终局）

## 症状

- `https://www.voxalo.top/` → 200 ✅
- `https://www.voxalo.top/login` → 200 ✅  
- `https://www.voxalo.top/api/webhooks/inbound` → **404** ❌
- `X-Matched-Path: /api/webhooks/inbound` 响应头存在 → Next.js 路由注册了，但返回 notFound
- `inbound_debug` 表始终 0 行 → traceWrite 从未执行
- Worker 日志显示 `forwarded ok`（旧代码时间戳，非新部署）

## 根因

**Vercel 项目名拼写错误**：主站项目在 Vercel 里叫 **`qf-aap`**（不是 `qf-app`），用户之前截图确认。所有对 `www.voxalo.top` 的 POST 请求都落到这个项目，但项目名拼错导致 Next.js 路由表没有包含 `app/api/webhooks/inbound/route.ts`（可能该文件在创建项目后被移动/重命名过，或项目绑定的是旧 commit）。

## 验证方法（AI 自测，不劳用户）

```bash
# 1. 测试 API 是否通（应返回 200 或 401，不能是 404）
curl -s -X POST "https://www.voxalo.top/api/webhooks/inbound" \
  -H "Content-Type: application/json" \
  -H "x-inbound-secret: <密钥>" \
  -d '{"test":1}'
# 期望: {"ok":true,...} 或 401 unauthorized — 绝不能是 404

# 2. 核对部署 sha
curl -s "https://api.github.com/repos/liuxiaohang666888/quotefollow/deployments?per_page=5" \
  | grep -E '"environment"|"sha"|"commit_ref"'

# 3. 检查 GitHub 文件是否存在
curl -s "https://api.github.com/repos/liuxiaohang666888/quotefollow/contents/app/api/webhooks/inbound/route.ts" \
  | grep '"name"'
```

## 修复步骤

1. **去 Vercel Dashboard → 项目列表**，确认主站项目名（本例是 `qf-aap`，不是 `qf-app`）
2. **强制 Redeploy**：点 Deployments → 最新那条 → Redeploy（**取消勾选"Use existing Build Cache"**）
3. 等 2-3 分钟 build 完成
4. **再次 curl 验证** API 返回 200/401（不是 404）
5. 让用户发一封新测试邮件，查 `inbound_debug` 表是否有新记录

## 教训

| 陷阱 | 避免方法 |
|------|---------|
| Vercel 项目名 ≠ GitHub repo 名 | 新建 Vercel 项目时名字和 repo 保持一致（qf-app） |
| git push 后线上仍是旧版本 | 永远手动点 Redeploy，不信任自动部署 |
| 6个垂直站点共用同一 repo | Vercel 一个项目绑定一个 repo 分支/目录，不要把 6 个垂直站混在一个项目里 |
| Worker 日志显示 forwarded ok 不代表真正成功 | 看时间戳：日志如果是几小时前的缓存，不代表当前版本在工作 |
| `inbound_debug` 0 行 = 代码根本没执行到 | 先确认 Vercel 部署的是哪个 commit，再确认那个 commit 里有没有 traceWrite |

## 相关排查文件

- `email-pipeline-final-diagnosis-2026-09-07.md` 第1-7层诊断手册
- `references/email-reply-pairing-2026-09-07.md` 邮件配对逻辑详解
- `references/vercel-deploy-troubleshoot-2026-09-03.md` Vercel 部署问题通用排查
