/**
 * 多邻国 Duolingo Super —— Loon 脚本（v5）
 *
 * 逻辑来源：qinxi duolingo_app_sub.js v1.5.0（QX script-analyze-echo-response）。
 * 运行方式：Loon [Script] http-request。脚本自己把请求重发一遍，改完用户资料后
 * 用 $done({response}) 直接把响应交回客户端，因此不依赖 Loon 的响应体复写缓冲。
 *
 * 与 QX 原脚本的区别 / 依据：
 * 1. 同时处理 /日期/users/数字ID 直连资料与 /日期/batch（新版 App 不再把用户资料放进 batch）。
 * 2. 除订阅字段外，额外按官方用户资料字段 health.unlimitedHeartsAvailable 打开无限能量，
 *    该字段来自仍在维护的用户脚本（Duolingo Unlimited Hearts / Duolingo Super，
 *    WORKS AS OF 2025-11-22），QX 原脚本没有这一条。
 * 3. 任何一步失败都调用 $done({})，让 Loon 按原请求继续，不会把请求卡死。
 */

var DL_TAG = '[Duolingo Super]';
var DL_INTERNAL = '__loon_internal=1';
var DL_PRODUCT = 'com.duolingo.DuolingoMobile.subscription.Gold.TwelveMonth.25Q3IncMS87D.Trial7.240';
var DL_SUBSCRIPTION_DAYS = 400;
var DL_EXPIRATION_MS = DL_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
var DL_FETCH_TIMEOUT_MS = 45000;
// 必须小于插件规则里的 timeout=60，这样 Loon 终止脚本之前我们还能自己放行。
var DL_WATCHDOG_MS = 50000;

function dlLog(message) {
    try { console.log(DL_TAG + ' ' + message); } catch (error) { /* 日志失败不影响改写 */ }
}

function dlIsObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function dlIsUser(value) {
    return dlIsObject(value) && (value.subscriberLevel !== undefined ||
        (value.id !== undefined && value.id !== null && !!value.learningLanguage));
}

function dlSubscriptionConfig(now) {
    return {
        vendorPurchaseId: 'mock_purchase_' + now,
        isInBillingRetryPeriod: false,
        isInGracePeriod: false,
        pauseStart: null,
        pauseEnd: null,
        productId: DL_PRODUCT,
        receiptSource: 1,
        expirationTimestamp: now + DL_EXPIRATION_MS,
        isFreeTrialPeriod: false,
        itemType: 'gold_subscription'
    };
}

function dlGoldShopItem(now, ownerId) {
    return {
        purchaseId: 'mock_gold_' + now,
        purchaseDate: Math.floor(now / 1000),
        purchasePrice: 0,
        id: 'gold_subscription',
        itemName: 'gold_subscription',
        subscriptionInfo: {
            currency: 'USD',
            expectedExpiration: Math.floor((now + DL_EXPIRATION_MS) / 1000),
            isFreeTrialPeriod: false,
            isIntroOfferPeriod: false,
            isInBillingRetryPeriod: false,
            periodLength: 12,
            price: 0,
            productId: DL_PRODUCT,
            renewer: 'APPLE',
            renewing: false,
            tier: 'twelve_month',
            type: 'gold',
            vendorPurchaseId: 'mock_vendor_' + now,
            promotionalOfferId: '',
            firstPaymentDate: 0
        },
        familyPlanInfo: {
            ownerId: ownerId || 0,
            secondaryMembers: [],
            inviteToken: '',
            pendingInvites: [],
            pendingInviteSuggestions: []
        }
    };
}

function dlHasGoldShopItem(shopItems) {
    return shopItems.some(function (item) {
        return dlIsObject(item) && (item.id === 'gold_subscription' || item.itemName === 'gold_subscription');
    });
}

/** 就地改写一个用户资料对象。字段与 QX 原脚本一致，另外打开无限能量。 */
function dlPatchUser(user, now) {
    user.subscriberLevel = 'GOLD';
    user.hasPlus = true;
    user.subscriptionConfigs = [dlSubscriptionConfig(now)];

    if (dlIsObject(user.adsConfig) && dlIsObject(user.adsConfig.units) &&
        Object.keys(user.adsConfig.units).length > 0) {
        user.adsConfig.units = {};
    }

    if (dlIsObject(user.trackingProperties)) {
        user.trackingProperties.has_item_gold_subscription = true;
        if (user.trackingProperties.monetizable_status === 'free_trial_eligible') {
            user.trackingProperties.monetizable_status = 'free_trial_owner_super';
        }
    }

    // 无限能量：只在服务端本来就返回 health 时补标志位，避免清空客户端已有的其它 health 字段。
    if (dlIsObject(user.health)) {
        user.health.unlimitedHeartsAvailable = true;
    }

    if (Array.isArray(user.shopItems) && !dlHasGoldShopItem(user.shopItems)) {
        user.shopItems.push(dlGoldShopItem(now, user.id));
    }
}

/**
 * 改写响应体。返回新 body；没有任何用户资料被改写时返回 null（调用方原样转发上游响应）。
 */
function dlPatchBody(rawBody) {
    if (typeof rawBody !== 'string' || rawBody.length === 0) return null;

    var payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (error) {
        dlLog('upstream body is not JSON; passthrough');
        return null;
    }

    var now = Date.now();
    var touched = false;

    if (dlIsObject(payload) && Array.isArray(payload.responses)) {
        payload.responses.forEach(function (entry) {
            if (!dlIsObject(entry) || typeof entry.body !== 'string') return;
            var inner;
            try {
                inner = JSON.parse(entry.body);
            } catch (error) {
                return;
            }
            if (!dlIsUser(inner)) return;
            dlPatchUser(inner, now);
            entry.body = JSON.stringify(inner);
            touched = true;
        });
    } else if (dlIsUser(payload)) {
        dlPatchUser(payload, now);
        touched = true;
    }

    return touched ? JSON.stringify(payload) : null;
}

function dlFetchOptions(request) {
    var headers = {};
    var sourceHeaders = dlIsObject(request.headers) ? request.headers : {};
    Object.keys(sourceHeaders).forEach(function (name) {
        var key = name.toLowerCase();
        // content-length 由 Loon 按实际 body 重算；br 内容在部分版本里不会解码成字符串，故只用 gzip/deflate。
        if (key === 'content-length') return;
        headers[key] = sourceHeaders[name];
    });
    headers['accept-encoding'] = 'gzip, deflate';

    var method = String(request.method || 'GET').toUpperCase();
    var options = {
        // 带上内部标记：Loon 可能对脚本自己发起的请求再跑一遍复写/脚本，标记保证只处理一次。
        url: request.url + (request.url.indexOf('?') >= 0 ? '&' : '?') + DL_INTERNAL,
        method: method,
        headers: headers,
        timeout: DL_FETCH_TIMEOUT_MS
    };
    if (method !== 'GET' && method !== 'HEAD' && request.body !== undefined) {
        options.body = request.body;
    }
    return options;
}

function dlSend(options, callback) {
    var client = $httpClient;
    var method = String(options.method).toLowerCase();
    var send = typeof client[method] === 'function' ? client[method] : client.post;
    send.call(client, options, callback);
}

function dlResponseHeaders(response) {
    var cleaned = {};
    var sourceHeaders = dlIsObject(response && response.headers) ? response.headers : {};
    Object.keys(sourceHeaders).forEach(function (name) {
        var key = name.toLowerCase();
        if (key === 'content-length' || key === 'content-encoding' || key === 'transfer-encoding') return;
        cleaned[name] = sourceHeaders[name];
    });
    return cleaned;
}

function dlDone(payload) {
    try {
        $done(payload);
    } catch (error) {
        dlLog('$done failed');
    }
}

function dlLogUrl(url) {
    return String(url).split('?')[0];
}

function dlMain() {
    if (typeof $request === 'undefined' || $request === null || typeof $request.url !== 'string') {
        dlLog('no request; passthrough');
        dlDone({});
        return;
    }
    // 自己发起的重放请求：直接放行，避免递归。
    if ($request.url.indexOf(DL_INTERNAL) >= 0) {
        dlDone({});
        return;
    }
    if (typeof $httpClient === 'undefined') {
        dlLog('$httpClient missing; passthrough');
        dlDone({});
        return;
    }

    var finished = false;
    var timer;
    function finish(payload) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        dlDone(payload);
    }

    timer = setTimeout(function () {
        dlLog('watchdog timeout; passthrough');
        finish({});
    }, DL_WATCHDOG_MS);

    var options = dlFetchOptions($request);
    dlLog('replay ' + options.method + ' ' + dlLogUrl(options.url));

    dlSend(options, function (error, response, data) {
        if (error) {
            dlLog('replay failed; passthrough');
            finish({});
            return;
        }
        if (typeof data !== 'string') {
            dlLog('replay returned non-text body; passthrough');
            finish({});
            return;
        }

        var status = (response && (response.status || response.statusCode)) || 200;
        var body = dlPatchBody(data);
        dlLog(body === null ? 'replay ok; no user data changed' : 'replay ok; user data patched');
        finish({
            response: {
                status: status,
                headers: dlResponseHeaders(response),
                body: body === null ? data : body
            }
        });
    });
}

dlMain();
