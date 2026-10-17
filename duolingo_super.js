/**
 * 多邻国 Duolingo —— Loon http-response 脚本（v8）。
 * 直接处理 $response.body，不重发请求；订阅字段沿用 v7。
 * 客户端字段变化不等于服务端授予权益，也不能证明 iOS 电池一定显示无限。
 */

var DL_TAG = '[Duolingo v8]';
var DL_PRODUCT = 'com.duolingo.DuolingoMobile.subscription.Premium.OneMonth.26Q3FP230D.17';
var DL_ITEM_TYPE = 'premium_subscription';
// 第一项保留免费账号原值，其余来自 226 抓包中的 Premium advertisableFeatures。
var DL_FEATURES = [
    'EXPLAIN_MY_ANSWER_FOR_ENERGY_COST',
    'NO_NETWORK_ADS',
    'UNLIMITED_HEARTS',
    'LEGENDARY_LEVEL',
    'MISTAKES_INBOX',
    'MASTERY_QUIZ',
    'NO_SUPER_PROMOS',
    'LICENSED_SONGS',
    'CHAT_TUTORS',
    'EXPLAIN_MY_ANSWER',
    'VIDEO_CALL_IN_PATH',
    'VIDEO_CALL_IN_PRACTICE_HUB'
];
var DL_EXPIRATION_MS = 400 * 24 * 60 * 60 * 1000;

function dlLog(message) {
    try { console.log(DL_TAG + ' ' + message); } catch (error) { /* 日志失败不影响放行 */ }
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
        itemType: DL_ITEM_TYPE
    };
}

function dlPremiumShopItem(now, ownerId) {
    return {
        purchaseId: 'mock_premium_' + now,
        purchaseDate: Math.floor(now / 1000),
        purchasePrice: 0,
        id: DL_ITEM_TYPE,
        itemName: DL_ITEM_TYPE,
        subscriptionInfo: {
            currency: 'USD',
            expectedExpiration: Math.floor((now + DL_EXPIRATION_MS) / 1000),
            isFreeTrialPeriod: false,
            isIntroOfferPeriod: false,
            isInBillingRetryPeriod: false,
            periodLength: 1,
            price: 0,
            productId: DL_PRODUCT,
            renewer: 'APPLE',
            renewing: false,
            tier: 'one_month',
            type: 'premium',
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

function dlHasSubscriptionShopItem(shopItems) {
    return shopItems.some(function (item) {
        return dlIsObject(item) && (item.id === DL_ITEM_TYPE || item.itemName === DL_ITEM_TYPE);
    });
}

function dlPatchFeatures(payload) {
    if (!Array.isArray(payload.subscriptionFeatures)) return false;
    payload.subscriptionFeatures = DL_FEATURES.slice();
    return true;
}

function dlPatchUser(user, now) {
    user.subscriberLevel = 'PREMIUM';
    user.hasPlus = true;
    user.subscriptionConfigs = [dlSubscriptionConfig(now)];

    if (dlIsObject(user.adsConfig) && dlIsObject(user.adsConfig.units) &&
        Object.keys(user.adsConfig.units).length > 0) {
        user.adsConfig.units = {};
    }
    if (dlIsObject(user.trackingProperties)) {
        user.trackingProperties.has_item_gold_subscription = true;
        user.trackingProperties.has_item_premium_subscription = true;
    }
    // 只改已有 health 对象里的红心标志，不改 energyConfig 数值或猜测能量字段。
    if (dlIsObject(user.health)) user.health.unlimitedHeartsAvailable = true;
    if (Array.isArray(user.shopItems) && !dlHasSubscriptionShopItem(user.shopItems)) {
        user.shopItems.push(dlPremiumShopItem(now, user.id));
    }
}

/** 返回改写后的 JSON；无关或无效响应返回 null，让 Loon 保留原响应。 */
function dlPatchBody(rawBody) {
    if (typeof rawBody !== 'string' || rawBody.length === 0) return null;
    var payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (error) {
        dlLog('invalid JSON; passthrough');
        return null;
    }

    if (dlIsObject(payload) && dlPatchFeatures(payload)) {
        dlLog('subscriptionFeatures=' + payload.subscriptionFeatures.length);
        return JSON.stringify(payload);
    }

    var now = Date.now();
    var touched = false;
    if (dlIsObject(payload) && Array.isArray(payload.responses)) {
        payload.responses.forEach(function (entry) {
            if (!dlIsObject(entry) || typeof entry.body !== 'string') return;
            var inner;
            try { inner = JSON.parse(entry.body); } catch (error) { return; }
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

function dlMain() {
    if (typeof $response === 'undefined' || !$response || typeof $response.body !== 'string') {
        dlLog('response body missing; passthrough');
        $done({});
        return;
    }
    var status = Number($response.status);
    if (!(status >= 200 && status < 300)) {
        dlLog('non-success response; passthrough');
        $done({});
        return;
    }
    var body = null;
    try { body = dlPatchBody($response.body); } catch (error) { dlLog('patch failed; passthrough'); }
    dlLog(body === null ? 'unchanged' : 'response body patched');
    // Loon 按新 body 重算长度及编码；保留原响应的状态码、Cookie 和其它响应头。
    $done(body === null ? {} : {body: body});
}

dlMain();
