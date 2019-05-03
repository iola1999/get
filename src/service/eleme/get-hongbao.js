const querystring = require("querystring");
const cookie2sns = require("./core/cookie2sns");
const Request = require("./core/request");
const logger = require("../../util/logger")("service/eleme");
const CookieStatus = require("../../constant/cookie-status");
const getHongbaoResponse = require("../get-hongbao-response");

module.exports = async (req, res) => {
  let { url, cookies, limit } = req.body;
  const response = getHongbaoResponse(req, res);

  if (!url) {
    return response(1, "请将信息填写完整");
  }

  // // 某些地方复制出的链接带 &amp; 而不是 &
  // 饿了么四月底改动，部分链接应使用 ? 截断
  // // 饿了么链接是 # 后面做参数，所以截后面操作
  const query = querystring.parse(
    String(url)
      .replace(/&amp;/g, "&")
      .replace(/hongbao\/\?/, "hongbao/#")
      .split("#")[1]
  );

  const request = new Request(query);
  let index = 0;
  let number = -1;
  let type;
  let isLuckyGroup;

  try {
    const { is_lucky_group, lucky_number } = await request.lucky(query);
    query.lucky_number = lucky_number || query.lucky_number;
    isLuckyGroup = is_lucky_group;
  } catch (e) {
    return response(3, `饿了么红包链接不正确或请求饿了么超时：${e.message}`);
  }

  if (
    !isLuckyGroup ||
    !query.sn ||
    !query.lucky_number ||
    isNaN(query.lucky_number)
  ) {
    return response(3, "饿了么红包链接不正确");
  }

  const lucky = await (async function lottery() {
    const cookie = cookies[index++];
    if (!cookie) {
      // 传过来的 cookie 不够用
      return response(
        4,
        "请求饿了么服务器失败，请重试。如果重试仍然不行，请换一个饿了么链接再来",
        { type }
      );
    }

    const sns = cookie2sns(cookie.value) || {};
    let data;

    try {
      data = await request.hongbao(sns);
    } catch (e) {
      if (e.response) {
        data = e.response.data;
        if (data) {
          if (["SNS_UID_CHECK_FAILED", "UNAUTHORIZED"].includes(data.name)) {
            cookie.status = CookieStatus.INVALID;
          } else if ("PHONE_IS_EMPTY" === data.name) {
            cookie.status = CookieStatus.SUSPEND;
          }
        }
        if (
          [400, 401, 500].includes(e.response.status) &&
          index < cookies.length - 1
        ) {
          return lottery();
        }
      } else {
        logger.error(e.message);
      }
    } finally {
      logger.info(data);
    }

    if (!data) {
      return lottery();
    }

    // 有错误
    if (data.name) {
      if (["SNS_UID_CHECK_FAILED", "UNAUTHORIZED"].includes(data.name)) {
        cookie.status = CookieStatus.INVALID;
      } else if ("PHONE_IS_EMPTY" === data.name) {
        cookie.status = CookieStatus.SUSPEND;
      }
      return lottery();
    }

    // 记录红包类型
    if (type === undefined && data.promotion_items.length > 0) {
      const typeName = data.promotion_items[0].name;
      if (typeName === "拼手气红包") {
        type = 0;
      } else if (typeName === "品质联盟专享红包") {
        type = 1;
      }
    }

    switch (data.ret_code) {
      case 1:
        // 红包被抢完了
        break;
      case 2:
        // 这个号 抢过这个红包
        cookie.status = CookieStatus.USED;
        break;
      case 3:
      case 4:
        // 领取成功
        cookie.status = CookieStatus.SUCCESS;
        break;
      case 5:
        // 没次数了，有可能是手机号没次数了，也有可能是 cookie 没次了
        // 如果是自己的号领的，没次了，直接提示
        cookie.status = CookieStatus.LIMIT;
        break;
    }

    // 计算剩余第几个为最佳红包
    number = query.lucky_number - data.promotion_records.length;

    // 领完了 或 超过最大包的个数
    if (data.ret_code === 1 || number <= 0) {
      const lucky = data.promotion_records[query.lucky_number - 1];
      logger.info("手气最佳红包已被领取", lucky);

      // 还是取不到，可能是因为领完了，不会返回数组了
      if (!lucky) {
        return response(0, "手气最佳红包已被领取", {
          nickname: "未知",
          price: 0,
          date: "未知",
          id: query.sn,
          type
        });
      }
      lucky.type = type;
      return lucky;
    }

    logger.info(`还要领 ${number} 个红包才是手气最佳`);

    if (number === 1) {
      return response(
        99,
        "已领取到最佳前一个红包。下一个是最大红包，请手动打开红包链接领取",
        { type }
      );
    }

    if (limit < number) {
      return response(
        8,
        `您的剩余可消耗次数不足以领取此红包，还差 ${number} 个是最佳红包`,
        { type }
      );
    }

    return lottery();
  })();

  if (!lucky) {
    return;
  }

  response(0, "手气最佳红包已被领取", {
    nickname: lucky.sns_username || "",
    price: parseFloat(lucky.amount || 0),
    date: new Date(lucky.created_at * 1000).toString(),
    id: query.sn,
    type: lucky.type
  });
};
