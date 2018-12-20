const axios = require("axios-https-proxy-fix");
const querystring = require("querystring");
const rohr = require("./rohr");
const crypto = require("./crypto");
const logger = require("../../../util/logger")("service/meituan");
const cleanCookie = require("../../clean-cookie");
const proxyServer = require("../../proxy-server");

const origin = "https://activity.waimai.meituan.com";

module.exports = class Request {
  constructor() {
    this.http = axios.create({
      baseURL: origin,
      timeout: 3000,
      headers: {
        origin,
        referer: origin,
        "user-agent":
          "Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T MicroMessenger) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2564.23 Mobile Safari/537.36"
      },
      transformRequest: [data => querystring.stringify(data)],
      proxy: proxyServer()
    });
    this.mpHttp = axios.create({
      baseURL: origin,
      timeout: 3000,
      headers: {
        origin,
        referer:
          "https://servicewechat.com/wx2c348cf579062e56/138/page-frame.html",
        "X-Requested-With": "XMLHttpRequest",
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 12_0_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/16A405 MicroMessenger/6.7.4(0x1607042c) NetType/WIFI Language/zh_CN"
      },
      transformRequest: [data => querystring.stringify(data)],
      proxy: proxyServer()
    });
  }

  async getShareCouponMp({
    channelUrlKey,
    baseChannelUrlKey = channelUrlKey,
    urlKey,
    token
  }) {
    logger.info("getShareCouponMp");
    // 4201 需要验证码
    // 1006 该号码归属地暂不支持
    // 1 成功
    // 811 姿势不对 再来一次
    // 2001 活动未开始
    // 7001 今日领取次数已用完
    // 7003 已领过
    // 4000 抢光了
    // 7002 微信 cookie 不正确或失效
    // 7006 今日领取次数达达到上限
    // 4002 你已经抢过这个红包了
    // 4001 已过期（不知道是什么过期，我认为是红包，所以直接抛出了）
    // 4003 没领到（什么鬼）
    try {
      return this.mpHttp.post("/wechatapp/share/coupon/receive", {
        channelUrlKey,
        baseChannelUrlKey,
        urlKey,
        token
      });
    } catch (e) {
      logger.error(e.message);
      return {};
    }
  }

  async getShareCoupon({ phone, channelUrlKey, urlKey, url, dparam, cookie }) {
    logger.info(`getShareCoupon: 使用 ${phone} 尝试领取`);
    // 4201 需要验证码
    // 1006 该号码归属地暂不支持
    // 1 成功
    // 811 姿势不对 再来一次
    // 2001 活动未开始
    // 7001 今日领取次数已用完
    // 7003 已领过
    // 4000 抢光了
    // 7002 微信 cookie 不正确或失效
    // 7006 今日领取次数达达到上限
    // 4002 你已经抢过这个红包了
    // 4001 已过期（不知道是什么过期，我认为是红包，所以直接抛出了）
    // 4003 没领到（什么鬼）
    try {
      return this.post(
        "/coupon/grabShareCoupon",
        {
          userPhone: phone,
          channelUrlKey,
          urlKey,
          dparam,
          originUrl: url,
          baseChannelUrlKey: "",
          uuid: "",
          platform: 11,
          partner: 162,
          riskLevel: 71
        },
        {
          headers: {
            cookie: cleanCookie(cookie)
          }
        }
      );
    } catch (e) {
      // 这边 try catch 是 fix cookie 带特殊符号的情况下，直接返回。否则会导致一直在等待
      logger.error(e.message);
      return {};
    }
  }

  async shareChannelRedirect(params) {
    const { data } = await this.post(
      "/async/coupon/sharechannelredirect",
      params
    );
    return data;
  }

  async post(url, params = {}, config = {}) {
    params._token = rohr.reload(`${url}?${querystring.stringify(params)}`);
    const { data } = await this.http.post(url, params, config);
    data.data = crypto.decrypto(data.data);
    if (typeof data.data === "string") {
      data.data = JSON.parse(data.data);
    }
    return data;
  }
};
