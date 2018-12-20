const querystring = require("querystring");
const logger = require("../../util/logger")("service/eleme-star");
const Request = require("./core/request");
const CookieStatus = require("../../constant/cookie-status");
const getHongbaoResponse = require("../get-hongbao-response");

module.exports = async (req, res) => {
  const { url, cookies, limit } = req.body;
  const response = getHongbaoResponse(req, res);

  // https://star.ele.me/hongbao/wpshare?caseid=627616199&sign=7ef38c8ec9f0504a0b2ad41eeee93d10
  const { caseid, sign } = querystring.parse(url.split("?")[1]);
  logger.info("query", { caseid, sign });
  const request = new Request({ caseid, sign });

  let number;
  try {
    const infoRes = await request.getInfo(cookies[0].value);
    if (!infoRes) {
      return response(
        7,
        "请求饿了么服务器失败，请重试。如果重试仍然不行，请换一个饿了么链接再来"
      );
    }
    if (infoRes.status === 4) {
      return response(6, "该红包已被抢完，请换一个链接再来");
    }
    if (!infoRes.isLuckHongbao) {
      return response(3, "不是饿了么星选拼手气红包");
    }
    number = infoRes.luckyNumber - infoRes.friends_info.length;
    if (number <= 0) {
      return response(4, "手气最佳红包已被领取");
    }
    if (number === 1) {
      return response(
        0,
        "已领取到最佳前一个红包。下一个是最大红包，请手动打开红包链接领取"
      );
    }
  } catch (e) {
    return response(1, e.message);
  }

  let index = 1; // 前面用了一个
  while (true) {
    const cookie = cookies[index++];
    console.log(cookie);
    if (!cookie) {
      return response(
        2,
        "请求饿了么服务器失败，请重试。如果重试仍然不行，请换一个饿了么链接再来"
      );
    }
    try {
      const hongbaoRes = await request.getHongbao(cookie.value);
      const res = await request.getInfo(cookie.value);
      if (!res || !res.openid || !res.phone) {
        // 失效了
        cookie.status = CookieStatus.INVALID;
        console.log("失效 cookie，领下一个", cookie.id);
      } else {
        switch (res.status) {
          case 2:
            // 领成功
            cookie.status = CookieStatus.SUCCESS;
            break;
          case 4:
            return response(6, "该红包已被抢完，请换一个链接再来");
          case 5:
            // 这个号领过这个红包
            cookie.status = CookieStatus.USED;
            break;
        }
        number = res.luckyNumber - res.friends_info.length;
        if (number <= 0) {
          return response(4, "手气最佳红包已被领取");
        }
        if (number === 1) {
          return response(
            99,
            "已领取到最佳前一个红包。下一个是最大红包，请手动打开红包链接领取"
          );
        }
        if (limit < number) {
          return response(
            5,
            `您的剩余可消耗次数不足以领取此红包，还差 ${number} 个是最佳红包`
          );
        }
        logger.info(`还剩${number}个是最佳`);
      }
    } catch (e) {
      console.error(e.message);
    }
  }
};
