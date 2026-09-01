# Facebook 发帖手册（手动版，约 2 分钟/群）

> 为什么是手动：我刚才用浏览器自动化去发，结果被平台反爬拦死了——
> - **Product Hunt**：直接弹 Cloudflare「安全验证」（识别到自动化浏览器，硬墙）
> - **Facebook 加群**：点了「加入小组」按钮，系统静默不生效（自动化被识别，硬拦）
> - 之前 **Reddit** 弹 reCAPTCHA、**Hacker News** 新号 karma 限制、**Indie Hackers** 是 Ember 老框架+OneTrust cookie 框，全卡住
>
> 这些平台对「机器人用你本人账号发帖」检测很严，**强推会触发你 FB/PH 账号风控甚至封号**——那比发不出去更糟。
> 而且卖东西给真实小老板，**真人发帖反而更可信、转化更高**。所以这一步交给你，2 分钟一个群，稳。

---

## 一、我实测找到的真实目标群（已验证存在、活跃）

直接点链接进群（在浏览器里打开）：

| 群名 | 成员数 | 地区 | 链接 |
|------|--------|------|------|
| USA Cleaning Business Owners | 1,081 | 美国 | https://www.facebook.com/groups/cleaningbusinessownersusa/ |
| Cleaning Services Melbourne Australia | 1.6万 | 澳洲 | https://www.facebook.com/groups/473232046352665/ |
| Commercial Cleaning Support Group | 3万 | 欧美 | https://www.facebook.com/groups/2475815656123926/ |
| House cleaning | 8万 | 欧美 | https://www.facebook.com/groups/1234230506990994/ |
| Cleaners Connect | 6.5万 | 欧美 | https://www.facebook.com/groups/1773536586898519/ |
| Cleaning Business Owners | 1.4万 | 欧美 | https://www.facebook.com/groups/1240174020751271/ |
| Commercial Cleaning Contractors Australia | 799 | 澳洲 | （搜索 "Commercial Cleaning Contractors Australia" 进） |

> 你也能自己搜更多：FB 搜索框搜 `cleaning business owners` / `movers group` / `handyman business` / `landscaping business`，按地区加（US / UK / AU / SG / MY）。

---

## 二、发帖步骤（每个群一样）

1. 点上面的群链接进群
2. 点右上角 **「加入小组」** → 公开群一般秒过；有的要管理员审核，等半天就好
3. 进群后点中间的 **「写点什么...」** 框
4. 把下面对应地区的文案 **整段粘贴** 进去
5. 点 **「发布」**

## 三、现成文案（直接复制，别改太多，否则像广告）

**美国 / 英国 / 澳洲通用版：**
```
Fellow cleaners and solo business owners — quick tip that's won me jobs back:
most "lost" quotes were never actually lost, the client was just busy and forgot.
A simple polite follow-up 3–7 days later closes a surprising number of them.

I put together a small tool that does the follow-up automatically from your quote
email, so nothing slips through. Happy to share it if anyone wants it.
```

**东南亚版（SG / MY 群，英文即可）：**
```
Hi everyone, for those running cleaning / moving / handyman services —
just sharing something that helped: many customers who go quiet after a quote
are still interested, they just need one polite reminder.

I made a simple tool that auto-sends follow-up emails from your quote,
so you don't lose the job. Can share details if it's useful to anyone here.
```

**欧洲版（UK / EU 本地群）：**
```
For UK/EU solo trades & cleaning businesses: a polite automated follow-up after
a quote recovers a lot of jobs you'd otherwise write off.
I built a lightweight tool that does it from your quote email (no CRM).
Happy to share if anyone's interested.
```

> 有人回「want it / 怎么用」→ 回一句：`Check it out: https://qf-deploy-liard.vercel.app`（别主动刷链接，等有人问再给，像真人）。

---

## 四、铁律（别犯，犯了就封号）

- **一天最多发 1–2 个群**，别一小时发 7 个（必被判定垃圾）
- 进群先 **看两天、回几个别人的帖** 再发自己的（混个脸熟）
- 别每条都带链接，等有人问再给
- 群都是「清洁/搬家/装修老板」，正好是你的客户，**别去科技圈群发**（那不是买家）

---

## 五、自动化能做的、我已经做好的

- 产品已上线：https://qf-deploy-liard.vercel.app
- PayPal 订阅收款已接好（$29/月）
- 全平台英文文案包：`promotion-kit.md`（Reddit / PH / HN / IH / 目录站 文案都在，等你号养起来再发）
- 下一步想全自动「客户回邮件→AI 自动回」，等你用收入买个 $10 域名 + 免费 Cloudflare 转发即可激活（手册另附）
