const querystring = require('querystring');
const cookie2sns = require('./core/cookie2sns');
const Request = require('./core/request');
const MobileList = require('./core/mobile-list');
const logger = require('../../util/logger')('service/eleme');
const checkCookieResponse = require('../check-cookie-response');

const query = querystring.parse(
  'https://h5.ele.me/hongbao/#hardware_id=&is_lucky_group=True&lucky_number=8&track_id=&platform=4&sn=29e47b57971c1c9d&theme_id=1969&device_id='
);

module.exports = async (req, res) => {
  const {cookie} = req.body;
  const response = checkCookieResponse(req, res);

  if (cookie.indexOf('snsInfo[wx2a416286e96100ed]=') === -1 && cookie.indexOf('snsInfo[101204453]=') === -1) {
    return response(4, 'cookie 不正确，请确保内容包含：\n\nsnsInfo[wx2a416286e96100ed] 或 snsInfo[101204453]');
  }

  const sns = cookie2sns(cookie);
  if (!sns || !sns.openid) {
    return response(1, 'cookie 不正确，请按照教程一步一步获取');
  }

  const request = new Request({sn: query.sn});
  let count = 0;

  return (async function check() {
    try {
      const data = await request.hongbao({
        phone: MobileList.getOne(),
        openid: sns.openid,
        sign: sns.eleme_key,
        platform: query.platform
      });

      if (data.name === 'SNS_UID_CHECK_FAILED') {
        return response(1, 'cookie 不正确，请按照教程一步一步获取');
      }

      if (data.ret_code === 5) {
        return response(2, '请换一个不领饿了么红包的小号来贡献');
      }

      response(0, 'cookie 验证通过', sns);
    } catch (e) {
      logger.error(e.message);
      if ([400, 500].includes((e.response || {}).status) && ++count < 5) {
        return check();
      }
      return response(3, 'cookie 不正确 或 网络繁忙');
    }
  })();
};
