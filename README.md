# loon-plugins

Loon 插件与脚本（多邻国 Duolingo Super / 无限红心·无限能量），当前 **v7**。

## 文件

| 文件 | 用途 |
|---|---|
| `duolingo_native.plugin` | 纯 Loon 原生重写版，不需要脚本（对应本地 `多邻国.plugin`）。两条规则：① `available-features` 的 `subscriptionFeatures` 权益列表（客户端判断无限红心/能量的地方，响应 200 字节）；② 完整用户资料用 `response-body-replace-regex` 做文本替换 —— 那份响应有 10.5 MB，不解析 JSON |
| `duolingo_script.plugin` | 脚本版：请求阶段重发并改写响应，同样先改权益列表，也能处理 `/batch` 里以字符串嵌套的用户对象 |
| `duolingo_super.js` | 脚本本体，由 `duolingo_script.plugin` 通过 raw URL 引用 |

两个插件只启用一个，否则同一份响应会被改两遍。

## 远程导入

```
https://raw.githubusercontent.com/shilianmalaxiangguo/loon-plugins/main/duolingo_native.plugin
```

## 依据（v7）

- 客户端判断「无限红心 / 无限能量」用的是 `GET /日期/users/<ID>/available-features` 里的
  `subscriptionFeatures` 字符串数组。免费账号那份只有 `EXPLAIN_MY_ANSWER_FOR_ENERGY_COST`。
- 灌进去的权益名不是编的：`subscription-catalog` 里 Premium（Super）的 `advertisableFeatures`
  就是 `NO_NETWORK_ADS`、`UNLIMITED_HEARTS`、`LEGENDARY_LEVEL`、`MISTAKES_INBOX`、`MASTERY_QUIZ`、
  `NO_SUPER_PROMOS`、`LICENSED_SONGS`、`CHAT_TUTORS`、`EXPLAIN_MY_ANSWER`、`VIDEO_CALL_IN_PATH`、
  `VIDEO_CALL_IN_PRACTICE_HUB`（同一个抓包可见）；ReVanced/Morphe 的 Duolingo 补丁在客户端构造的
  也是这同一个集合，并把 `health` 初始化参数 `unlimitedHeartsAvailable` 置 1。
- `SubscriberLevel` 枚举：**PREMIUM = Super，GOLD = Max**；商店里卖的 tier 是 `PREMIUM_SUBSCRIPTION`
  / `LITE_SUBSCRIPTION`，所以订阅条目用 `itemType: premium_subscription`。
- 10.5 MB 用户资料用文本替换（`response-body-replace-regex`）而不是 JSON 动作：226 抓包里这份 body
  被导出工具截到 2 MB，JSON 动作只能放弃，正则照样改得动。224 抓包上验证：只有 6 个顶层键变化，
  `currentCourse`、`energyConfig` 逐字节不变。
- `/batch` 不改：226 抓包里它的响应只有 `eventBlocklist` / `apiHost` / `clientExperiments` / `featureFlags`，
  用户资料是直连的。
