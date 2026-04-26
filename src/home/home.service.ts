import { Injectable } from '@nestjs/common';

@Injectable()
export class HomeService {
  getHome() {
    return {
      logoText: '养个石头',
      tiles: [
        { id: 'diy', label: 'DIY-CUSTOM', sub: '设计手串', image: '', path: '/pages/design/design' },
        { id: 'goods', label: 'DESIGN-PLAZA', sub: '设计广场', image: '', path: '/pages/goods/goods' },
      ],
      banners: [{ id: 'b1', image: '', link: '' }],
      designs: [
        { id: 'd1', title: '菩提蛋糕', author: '@吴烦恼', image: '', cta: '查看实物' },
        { id: 'd2', title: '怒目绿龙', author: '@Oo', image: '', cta: '查看实物' },
      ],
    };
  }
}
