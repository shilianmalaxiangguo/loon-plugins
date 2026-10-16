# loon-plugins

Loon 插件与脚本（多邻国 Duolingo Super / 无限能量）。

## 文件

| 文件 | 用途 |
|---|---|
| `duolingo_native.plugin` | 纯 Loon 原生重写版，不需要脚本：直接改 `health.unlimitedHeartsAvailable`、`subscriberLevel`、`subscriptionConfigs` 等（对应本地 `多邻国.plugin`） |
| `duolingo_script.plugin` | 脚本版：请求阶段重发并改写响应，能处理 `/batch` 里以字符串嵌套的用户对象（对应本地 `多邻国-脚本版.plugin`） |
| `duolingo_super.js` | 脚本本体，由 `duolingo_script.plugin` 通过 raw URL 引用 |

两个插件只启用一个，否则同一份响应会被改两遍。

## 远程导入

Loon → 配置 → 插件 → 添加，填：

```
https://raw.githubusercontent.com/shilianmalaxiangguo/loon-plugins/main/duolingo_native.plugin
```

## 旁证

- 无限红心/能量开关 `health.unlimitedHeartsAvailable = true` 来自仍在维护的用户脚本 `eztakesin/duolingo-mitm-lab`。
- 订阅字段集（`subscriberLevel`/`hasPlus`/`subscriptionConfigs`/`adsConfig`/`trackingProperties`/`shopItems`）来自 `qinxi/script` 的 Quantumult X 脚本 v1.5.0。
- 真实抓包（DuolingoMobile/7.144.0，2026-10）验证：用户资料直连 `/2023-05-23/users/<ID>?fields=…`，`/batch` 只带配置。
