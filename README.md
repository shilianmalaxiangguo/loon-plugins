# 多邻国 Loon v8：修正响应处理与版本分发

## 243 抓包能证明什么

检查的是导出的原始响应和 `replace_response_body_raw`，不是仅凭插件是否命中。

| 记录 | 实际内容 | 结论 |
|---|---|---|
| `68_98_1792240316473` → 内部请求 `0_104_1792240316727` | App 侧改写后响应与内部请求的响应逐字节相同，204 字节，只有 `EXPLAIN_MY_ANSWER_FOR_ENERGY_COST` | 此次没有把 v7 的 12 项权益列表交给 App |
| `68_100_1792240316476` → `0_140_1792240316914` | 另一条 available-features 查询也原样返回 | 不是单个 courseId 查询遗漏 |
| `0_152_1792240317042` | 10,546,242 字节，完整且可解析的 JSON；`subscriberLevel=FREE`、缺少 `hasPlus`、`unlimitedHeartsAvailable=false`、能量 20/20 | 这是带 `__loon_internal=1` 的内部请求响应，不能当作 App 最终收到的资料 |
| App 原始资料请求 `68_117_1792240316811` | ZIP 中仅有 request_header，没有原始或改写后响应 | 交付结果未知，不能声称已经送达，也不能断言永久卡住 |

离线把同一份权益响应交给旧 v6 与当前 v7：v6 原样返回 204 字节，与抓包相同；v7 返回 397 字节、12 项权益。

**[INFERENCE] 手机仍使用旧缓存脚本，或旧规则接管了响应。** 抓包不能区分两者；不能仅凭上述一致性认定具体版本。

## 撤回先前不充分的结论

- `UNLIMITED_HEARTS` 和 `health.unlimitedHeartsAvailable` 与红心有关；Android 补丁和商品宣传字段不能证明它们就是当前 iOS 能量电池的无限开关。
- 226 ZIP 导出体被截断，不代表 Loon 在执行改写时也只拿到截断体。此前据此认定 JSON 动作失效，是把导出限制当作运行时证据。
- `replace_response_body_raw` 存在，只说明记录了一份替代响应；此次它与上游相同，不等于字段已改。
- 本地测试能验证 JSON 改写和脚本返回契约，不能证明手机显示无限，更不能改变服务端的真实订阅或扣能量规则。

## v8 改动

1. 统一为一个 `多邻国.plugin`，使用 Loon 官方的 `http-response` 契约：读取 `$response.body`，通过顶层 `$done({body: ...})` 返回。移除请求重发、内部 URL 标记、网络超时计时器和请求阶段合成响应。
2. `script-path` 固定到 Git 提交 `0224ec5479fdd1d0407f4cb07c2be2c62ff81993`，不再复用旧 `main/duolingo_super.js` 下载地址。日志前缀为 `[Duolingo v8]`。
3. 本次不继续猜测能量字段。沿用 v7 的订阅/红心字段改写，保留 `energyConfig` 和课程数据；先验证改写后的响应确实交给 App。
4. 无效 JSON、非文本 body、非成功 HTTP 响应放行；不修补截断 JSON，也不伪造错误响应。

旧版原生重写与请求重发插件停止分发，历史 v7 包只作留档，不能与 v8 同时启用。

官方响应脚本契约：[Loon Script / http-response](https://github.com/Loon0x00/LoonManual/blob/master/docs/cn/script.md#http-response)。

## 安装与设备验证

1. 停用所有旧版多邻国插件及同类本地重写、脚本。不必清空其它配置。
2. 导入本目录的 `多邻国.plugin`，或新的版本专用地址：

   `https://raw.githubusercontent.com/shilianmalaxiangguo/loon-plugins/main/duolingo_v8.plugin`

3. 插件名称应为 **多邻国 Duolingo v8 响应脚本**；脚本路径应含上面的提交号，而不是 `main/duolingo_super.js`。
4. 开启脚本、重写、MITM，证书完全信任。彻底退出多邻国后重新打开，等首页加载结束再抓取完整响应。
5. 在脚本日志检查 `[Duolingo v8] subscriptionFeatures=12`；在**改写后响应**检查以下值，再观察电池与正常练习行为：
   - available-features：包含 `UNLIMITED_HEARTS`，共 12 项。
   - 用户资料：`subscriberLevel=PREMIUM`、`hasPlus=true`、`health.unlimitedHeartsAvailable=true`。
   - 不应再有本插件生成的 `__loon_internal=1` 请求；若仍存在，说明旧请求脚本还在运行。

如果日志是 v8、上述改写后字段也正确，但电池仍是 20，说明这些改写不足以实现当前客户端的无限能量。届时应分析实际生效的响应与客户端判断逻辑，不再把“改写字段”当成“无限已成功”。

## 本地验证与隐私

```sh
node --test tests/*.test.cjs
```

脚本测试使用脱敏固定样例，覆盖响应阶段字段交付、课程/能量保留、batch、局部资料、已有订阅、无效 body 和 HTTP 错误；路由测试排除购物、课程和其它域名。

此次额外离线运行了 243 的两份权益响应及 10.5 MB 资料。未重放 Cookie、未请求真实账号接口；原始抓包和账号数据不进入发布包或 GitHub。手机 Loon 运行与电池显示仍需设备验证。
