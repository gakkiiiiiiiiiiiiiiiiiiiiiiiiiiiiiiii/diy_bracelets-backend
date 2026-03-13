import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfileService {
  getProfile() {
    return {
      name: 'Gakkiiiiiiiiiiiiiii',
      greeting: '您好！欢迎来到养个石头',
      entries: [
        { id: 'design', label: '我的设计', sub: '查看已保存的设计记录', icon: 'D' },
        { id: 'orders', label: '我的订单', sub: '定制记录、购买记录', icon: 'O' },
        { id: 'address', label: '收货地址', sub: '完善地址，方便下单', icon: 'A' },
        { id: 'help', label: '帮助中心', sub: '有什么问题请联系客服处理', icon: 'H' },
        { id: 'terms', label: '条款和条件', sub: '我们的服务', icon: 'T' },
      ],
    };
  }
}
