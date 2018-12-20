const axios = require("axios-https-proxy-fix");
const proxyServer = require("../../proxy-server");
const logger = require("../../../util/logger")("service/eleme");

const origin = "https://h5.ele.me";
const referer = `${origin}/hongbao/`;
// 欢迎提交你的头像和昵称，让你在 mtdhb 领取时只要红包链接末尾带上 &_from=xxx 即可显示你设定的头像昵称
const from = {
  mtdhb: {
    avatar:
      "https://thirdqq.qlogo.cn/qqapp/101204453/029FDD924217DE97C2C674DB60B7B9D5/40",
    username: "mtdhb.org"
  },
  botii: {
    avatar:
      "https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTK84xyzRypsXulol2CNh1EFNWltJdHmHJrf5KPjrvmzA6rJgR8lgb66pAhbbR0ibUN0eBNCd8yN8Cw/132",
    username: "我肯定不吃夜宵啊"
  },
  xzk: {
    avatar:
      "https://thirdqq.qlogo.cn/qqapp/101204453/C2DC2E32ED38EA9185FBE11115286957/40",
    username: "小展开"
  }
};

module.exports = class Request {
  constructor({ sn, _from = "mtdhb" }) {
    this.sn = sn;
    this.from = from[_from] || from.mtdhb;
    this.http = axios.create({
      baseURL: origin,
      withCredentials: true,
      timeout: 3000,
      headers: {
        origin,
        referer,
        "content-type": "text/plain;charset=UTF-8",
        "user-agent":
          "Mozilla/5.0 (Linux; Android 7.0; MIX Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/6.2 TBS/044004 Mobile Safari/537.36 V1_AND_SQ_7.5.0_794_YYB_D QQ/7.5.0.3430 NetType/WIFI WebP/0.3.0 Pixel/1080"
      },
      transformRequest: [
        (data, headers) => {
          headers["x-shard"] =
            headers["x-shard"] || `eosid=${parseInt(sn, 16)}`;
          return JSON.stringify(data);
        }
      ],
      proxy: proxyServer()
    });
  }

  async lucky({ theme_id = "0" }) {
    for (const item of [theme_id, "1969", "2769"]) {
      try {
        const { data } = await this.http.get(
          `/restapi/marketing/themes/${item}/group_sns/${this.sn}`
        );
        if (data && !data.message) {
          return data;
        }
        logger.error(
          `尝试使用 theme_id ${item} 获取 lucky_number 失败：`,
          data
        );
      } catch (e) {
        logger.error(
          `尝试使用 theme_id ${item} 获取 lucky_number 失败：`,
          e.message
        );
      }
    }
    throw new Error("获取 lucky_number 失败");
  }

  async hongbao({ openid, sign, sid, sn = this.sn }) {
    logger.info("开始领取饿了么", {
      openid,
      sign,
      sid,
      sn
    });
    const { data = {} } = await this.http.post(
      `/restapi/marketing/promotion/weixin/${openid}`,
      {
        device_id: "",
        group_sn: sn,
        hardware_id: "",
        method: "phone",
        phone: "",
        platform: 4,
        sign,
        track_id: "",
        unionid: "fuck", // 别问为什么传 fuck，饿了么前端就是这么传的
        weixin_avatar: this.from.avatar,
        weixin_username: this.from.username
      },
      {
        headers: {
          "x-shard": `eosid=${parseInt(sn, 16)}`,
          cookie: `SID=${sid}`
        }
      }
    );
    data.promotion_records = data.promotion_records || [];
    return data;
  }
};
