const Request = require('./core/request');
const parseUrl = require('./core/parse-url');
const logger = require('../../util/logger')('service/meituan');
const Random = require('../../util/random');
const timeout = require('../../util/timeout');
const CookieStatus = require('../../constant/cookie-status');
const getHongbaoResponse = require('../get-hongbao-response');
const NO_MOBILE = '10000000000';

module.exports = async (req, res) => {
  let {url, mobile, cookies, limit} = req.body;
  const response = getHongbaoResponse(req, res);
  mobile = mobile || NO_MOBILE;

  if (!url || !mobile) {
    return response(1, '请将信息填写完整');
  }

  if (!/^1\d{10}$/.test(mobile)) {
    return response(2, '请填写 11 位手机号码');
  }

  let params;
  try {
    params = parseUrl(url);
  } catch (e) {
    return response(3, '美团红包链接不正确');
  }

  const request = new Request();
  const data = await request.shareChannelRedirect(params);
  if (data === false) {
    return response(3, '美团红包链接不正确');
  }

  const lucky = ~~data.share_title.match(/第(.*?)个/).pop();
  if (lucky === 0) {
    return response(12, '该红包已被领完 或 美团红包链接不正确');
  }

  logger.info(`第 ${lucky} 个是手气最佳红包`);

  let index = 0;
  let length = 0;
  let number = 99;

  (async function lottery(userPhone2) {
    if (mobile === NO_MOBILE && number === 1) {
      return response(99, '已领取到最佳前一个红包。下一个是最大红包，请手动打开红包链接领取');
    }

    const gsc2 = await (async function grabShareCoupon() {
      const cookie = cookies[index++];
      if (!cookie) {
        // 传过来的 cookie 不够用
        return response(4, '请求美团服务器失败，请重试');
      }

      const gsc = await request.getShareCoupon({
        url,
        cookie: cookie.value,
        phone: userPhone2 || Random.phone(userPhone2),
        channelUrlKey: data.channelUrlKey,
        urlKey: params.urlKey,
        dparam: data.dparam
      });

      logger.info(gsc.code, gsc.msg);

      if ([4001, 4003].includes(gsc.code)) {
        return response(5, '红包异常，请换一个红包链接再试');
      }

      if (gsc.code === 4000) {
        return response(12, '该红包链接已被他人抢完');
      }

      if ([1, 7003, 4002, 7006, 7001].includes(gsc.code)) {
        switch (gsc.code) {
          case 1:
            // 成功使用
            cookie.status = CookieStatus.SUCCESS;
            // 如果是用大号领取的，不管美团返回的数组长度
            length = userPhone2 === mobile ? lucky : gsc.data.wxCoupons.length;
            break;
          case 4002:
          case 7003:
            // 这个号领过
            cookie.status = CookieStatus.USED;
            // TODO: 有一定几率不对，有可能是 cookie 号领过，因为概率比较低，所以暂时先这样
            if (userPhone2 === mobile) {
              return response(
                11,
                '你的手机号之前领过小红包，无法领最大了。下一个是最大红包，别再点网站的领取按钮，请手动打开红包链接领取'
              );
            }
            break;
          case 7001:
          case 7006:
            // 没次数了，有可能是手机号没次数了，也有可能是 cookie 没次了
            // 如果是自己的号领的，没次了，直接提示
            if (userPhone2 === mobile) {
              return response(
                9,
                '你的手机号（或代领最佳的小号）今日领取次数已达上限。下一个是最大红包，别再点网站的领取按钮，请手动打开红包链接领取'
              );
            }
            cookie.status = CookieStatus.LIMIT;
            break;
        }
        return gsc;
      }

      // 如果本次是用大号领取的，并且报错了，直接抛出
      if (userPhone2 === mobile) {
        return response(
          6,
          gsc.code === 4201
            ? '你的手机号没有注册过美团。下一个是最大红包，别再点网站的领取按钮，请手动打开红包链接领取'
            : `美团返回错误（${gsc.code}）${gsc.msg}`
        );
      }

      if (gsc.code === 7002 || gsc.code === 811) {
        // 不可用 cookie，继续跑，并做记录
        cookie.status = CookieStatus.INVALID;
      } else if (gsc.code === 4201) {
        // 如果是一个新的号，需要验证码，则复用 cookie
        index--;
      }

      return grabShareCoupon();
    })();

    if (!gsc2) {
      return;
    }

    number = lucky - length;
    if (number <= 0) {
      // const best = gsc2.data.wxCoupons.find(w => w.bestLuck) || {}
      const best = gsc2.data.wxCoupons[lucky - 1] || {};
      logger.info('手气最佳红包已被领取 %j', best);
      return response(0, '手气最佳红包已被领取', {
        nickname: best.nick_name || '未知',
        price: (best.coupon_price || 0) / 100,
        date: best.dateStr || '未知',
        id: params.urlKey
      });
    }

    logger.info(`还有 ${number} 个是最佳红包`);

    if (limit - 1 < number - (mobile === NO_MOBILE ? 1 : 0)) {
      return response(8, `您的剩余可消耗次数不足以领取此红包，还差 ${number} 个是最佳红包`);
    }

    // 美团接口貌似有缓存，最后几次慢些请求，降低返回的数组长度错误概率
    if (number === 2 || number === 3) {
      await timeout(500);
    }

    await lottery(number === 1 ? mobile : null);
  })();
};
