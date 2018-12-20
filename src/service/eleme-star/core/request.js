const querystring = require("querystring");
const axios = require("axios-https-proxy-fix");
const proxyServer = require("../../proxy-server");
const logger = require("../../../util/logger")("service/eleme-star");

const origin = "https://star.ele.me";

module.exports = class Request {
  constructor({ caseid, sign }) {
    this.caseid = caseid;
    this.sign = sign;
    this.http = axios.create({
      baseURL: origin,
      withCredentials: true,
      timeout: 3000,
      maxRedirects: 0,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Linux; U; Android 2.3.6; zh-cn; GT-S5660 Build/GINGERBREAD) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1 MicroMessenger/4.5.255"
      },
      transformRequest: [
        (data, headers) => {
          return querystring.stringify(data);
        }
      ],
      proxy: proxyServer()
    });
  }

  async getInfo(cookie) {
    let res;
    try {
      const { data } = await this.http.get("/hongbao/wpshare", {
        params: {
          caseid: this.caseid,
          sign: this.sign
        },
        headers: {
          cookie
        }
      });
      res = data;
    } catch (e) {
      logger.error(e.message);
      res = e.response.data;
    }

    logger.info("饿了么星选 页面信息", res);

    res = this.getCenter(
      res,
      `require('mactivity:widget/redEnvelope/giftPackage/giftPackage').init(`,
      `);\n}catch(e){console.error(e)}}();`
    );

    if (!res) {
      return null;
    }

    res = JSON.parse(res);

    const { result } = res;
    if (!result) {
      return null;
    }

    let luckyNumber;
    if (result.share) {
      luckyNumber = Number(
        this.getCenter(result.share.share_title, `【饿了么星选】第`, "个领取")
      );
    }

    return {
      ...result,
      luckyNumber
    };
  }

  async getHongbao(cookie) {
    const { data } = await this.http.post(
      "/hongbao/wpshare",
      {
        caseid: this.caseid,
        sign: this.sign,
        opt: "get_shop_coupon",
        display: "json"
      },
      {
        headers: {
          cookie
        }
      }
    );
    logger.info("饿了么星选 领红包", data);
    return data;
  }

  getCenter(source, left, right) {
    try {
      const leftIndex = source.indexOf(left) + left.length;
      const rightIndex = source.indexOf(right, leftIndex);
      return source.substring(leftIndex, rightIndex);
    } catch (e) {
      return "";
    }
  }
};
