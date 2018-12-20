const parseCookie = require("./core/parse-cookie");
const Request = require("./core/request");
const logger = require("../../util/logger")("service/eleme");
const checkCookieResponse = require("../check-cookie-response");

module.exports = async (req, res) => {
  const { cookie } = req.body;
  const response = checkCookieResponse(req, res);

  const cookieObject = parseCookie(cookie);
  if (!cookieObject || !cookieObject.whid || !cookieObject.WMID) {
    return response(1, "cookie 不正确，请确保 cookie 同时包含 whid 和 WMID");
  }

  const request = new Request({
    caseid: "627616199",
    sign: "7ef38c8ec9f0504a0b2ad41eeee93d10"
  });
  try {
    const res = await request.getInfo(cookie);
    if (!res || !res.openid || !res.phone) {
      return response(
        3,
        "饿了么星选贡献失败，请确认小号已经微信授权并绑定手机号。如果一直贡献不上，请联系管理员"
      );
    }

    response(0, "cookie 验证通过", {
      openid: res.openid,
      headimgurl: "",
      nickname: "",
      phone: res.phone,
      service: 0
    });
  } catch (e) {
    response(2, e.message);
  }
};
