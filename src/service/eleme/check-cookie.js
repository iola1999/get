const cookie2sns = require("./core/cookie2sns");
const Request = require("./core/request");
const logger = require("../../util/logger")("service/eleme");
const checkCookieResponse = require("../check-cookie-response");
const Random = require("../../util/random");

module.exports = async (req, res) => {
  const { cookie } = req.body;
  const response = checkCookieResponse(req, res);

  const sns = cookie2sns(cookie);
  if (!sns || !sns.openid || !sns.eleme_key || !sns.sid) {
    return response(1, "cookie 不正确，请按照教程一步一步获取");
  }

  let count = 5;
  while (count--) {
    const request = new Request({
      sn: Random.array([
        // "110958316989f847",
        "2a1173143bb9980a",
        "1108e8499c2ac4c3",
        "2a11a2d58a2d608b",
        "2a11ac6d7b39c0d7",
        "2a1185a948ad3c1e",
        "2a117055611d0831",
        "1d2621a432acb0f6",
        "1108dc78caa9fc0f",
        "1d262ce9f92e88cc",
        "2a11b10fef387881",
        "1108e4025fab80ad",
        "1107a03221aa8c10",
        "2a11a44f4038785e",
        "2a10ed9daebad4d4",
        "1108ddb584a8289f",
        "2a11b558f93b904b",
        "2a11736da5b92cfa",
        "2a11ab36e3399852",
        "2a11b6d4762c54fc",
        "2a11a9b7182cd08c",
        "2a119768391f50a3",
        "1108da3c542b7465",
        "2a11b6ddc2bb909c",
        "1d26457d019b049e",
        "1d26458258a0c0f2",
        "2a11b2b28dbbb43d",
        "2a118dde1b3bb4b5",
        "2a10d6a8d539e430",
        "2a1199f665ac28fc",
        "2a103ca998b91061",
        "2a1160b216afd49a",
        "1d2601a1c1236c72",
        "2a11a8c3dabb305d",
        "1108da9aab2868b2",
        "2a11b5f43339e417"
      ])
    });

    let data;
    try {
      data = await request.hongbao(sns);
    } catch (e) {
      console.log(e.response);
      if (e.response) {
        data = e.response.data;
      } else {
        logger.error(e.message);
      }
    } finally {
      data = data || {};
      logger.info(data);
    }

    if (data.name) {
      if (data.name === "TOO_BUSY") {
        continue;
      }
      return response(1, `贡献失败，饿了么返回：${data.name} ${data.message}`);
    }

    // 如果要判断是否领满 5 次，则打开这个注释
    // if (data.ret_code === 5) {
    //   return response(2, '请换一个不领饿了么红包的小号来贡献');
    // }

    if (!data.account) {
      return response(3, "cookie 不正确 或 没有绑定手机号");
    }

    return response(0, "cookie 验证通过", {
      ...sns,
      phone: data.account
    });
  }

  response(
    4,
    "贡献失败，可能是网络原因，请尝试重试。如果一直贡献不上，请联系管理员"
  );
};
