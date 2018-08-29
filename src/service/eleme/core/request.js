const axios = require('axios-https-proxy-fix');
const proxyServer = require('../../proxy-server');
const logger = require('../../../util/logger')('service/eleme');

const origin = 'https://h5.ele.me';
const referer = `${origin}/hongbao/`;

module.exports = class Request {
  constructor({sn}) {
    this.sn = sn;
    this.http = axios.create({
      baseURL: origin,
      withCredentials: true,
      timeout: 3000,
      headers: {
        origin,
        referer,
        'content-type': 'text/plain;charset=UTF-8',
        'user-agent':
          'Mozilla/5.0 (Linux; Android 7.0; MIX Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/57.0.2987.132 MQQBrowser/6.2 TBS/044004 Mobile Safari/537.36 V1_AND_SQ_7.5.0_794_YYB_D QQ/7.5.0.3430 NetType/WIFI WebP/0.3.0 Pixel/1080'
      },
      transformRequest: [
        (data, headers) => {
          headers['X-Shard'] = `eosid=${parseInt(sn, 16)}`;
          return JSON.stringify(data);
        }
      ],
      proxy: proxyServer()
    });
  }

  async lucky({theme_id = '0'}) {
    const {data = {}} = await this.http.get(`/restapi/marketing/themes/${theme_id}/group_sns/${this.sn}`);
    return data;
  }

  async hongbao({phone, openid, sign, platform}) {
    const bind = async () => {
      await this.http.put(`/restapi/v1/weixin/${openid}/phone`, {sign, phone});
      logger.info('绑定手机号', phone);
    };

    try {
      await bind();
    } catch (e) {
      try {
        await bind();
      } catch (e) {
        logger.error('重试绑定仍然异常', e.message);
        return null;
      }
    }

    logger.info('使用 %s 领取', phone);

    const {data = {}} = await this.http.post(`/restapi/marketing/promotion/weixin/${openid}`, {
      device_id: '',
      group_sn: this.sn,
      hardware_id: '',
      method: 'phone',
      phone,
      platform,
      sign,
      track_id: '',
      unionid: 'fuck', // 别问为什么传 fuck，饿了么前端就是这么传的
      weixin_avatar: '',
      weixin_username: ''
    });
    logger.info('饿了么响应 %j', data);

    data.promotion_records = data.promotion_records || [];
    return data;
  }
};
