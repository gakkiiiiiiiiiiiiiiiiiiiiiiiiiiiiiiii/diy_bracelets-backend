export interface BrandContent {
  name: string;
  nameEn: string;
  tagline: string;
  primaryColor: string;
  secondaryColor: string;
  supportId: string;
  supportHours: string;
}

export interface HomeActionContent {
  label: string;
  path: string;
}

export interface HomeHeroContent {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  primaryAction: HomeActionContent;
}

export interface HomeMaterialItemContent {
  id: string;
  name: string;
  caption: string;
  image: string;
  categoryId: string;
}

export interface HomeMaterialSectionContent {
  eyebrow: string;
  title: string;
  description: string;
  items: HomeMaterialItemContent[];
}

export interface HomeFeaturedItemContent {
  id: string;
  title: string;
  caption: string;
  image: string;
  path: string;
}

export interface HomeFeaturedSectionContent {
  eyebrow: string;
  title: string;
  actionLabel: string;
  actionPath: string;
  items: HomeFeaturedItemContent[];
}

export interface HomeContent {
  hero: HomeHeroContent;
  materials: HomeMaterialSectionContent;
  featured: HomeFeaturedSectionContent;
}

export interface DiyExperiencePointContent {
  id: string;
  label: string;
}

export interface DiyMaterialPreviewContent {
  id: string;
  name: string;
  image: string;
}

export interface DiyContent {
  pageTitle: string;
  canvasTitle: string;
  canvasHint: string;
  noticeLabel: string;
  saveLabel: string;
  finishLabel: string;
  selectHint: string;
  stageLabel: string;
  stageHint: string;
  experiencePoints: DiyExperiencePointContent[];
  materialPreviews: DiyMaterialPreviewContent[];
}

export interface SupportHelpTopicContent {
  id: string;
  title: string;
  desc: string;
  items: string[];
}

export interface SupportPurchaseSectionContent {
  id: string;
  title: string;
  subtitle: string;
  points: string[];
  tone: string;
}

export interface SupportPurchaseContent {
  heroKicker: string;
  title: string;
  subtitle: string;
  contactText: string;
  sections: SupportPurchaseSectionContent[];
}

export interface SupportTermsSectionContent {
  title: string;
  body: string;
}

export interface SupportTermsContent {
  intro: string;
  sections: SupportTermsSectionContent[];
}

export interface SupportContent {
  helpTopics: SupportHelpTopicContent[];
  purchase: SupportPurchaseContent;
  terms: SupportTermsContent;
}

export type PageContent = Record<string, unknown>;

export interface DefaultPageConfig {
  key: string;
  name: string;
  content: PageContent;
}

const crystalRoot = '/static/materials/reference-crystals';
const shopRoot = '/static/shop-goods';

export const DEFAULT_PAGE_CONFIGS: DefaultPageConfig[] = [
  {
    key: 'brand',
    name: '品牌信息',
    content: {
      name: '珠岛',
      nameEn: 'ZHUDAO',
      tagline: '天然晶石，自由成形',
      primaryColor: '#527985',
      secondaryColor: '#D0A09D',
      supportId: 'ZHUDAO',
      supportHours: '工作日 10:00-19:00',
    },
  },
  {
    key: 'home',
    name: '首页内容',
    content: {
      hero: {
        eyebrow: 'NATURAL CRYSTAL · 3D DIY',
        title: '让每一颗晶石\n找到它的位置',
        description: '在真实材质与光线中自由搭配，实时看见专属于你的手串。',
        image: '/static/brand/zhudao-hero.png',
        primaryAction: {
          label: '开始 3D 设计',
          path: '/pages/design/design',
        },
      },
      materials: {
        eyebrow: 'MATERIAL LIBRARY',
        title: '从材质开始',
        description: '选择一种光泽，进入对应晶石系列。',
        items: [
          {
            id: 'moonstone',
            name: '蓝月光',
            caption: '柔光 · 通透',
            image: `${crystalRoot}/blue-moonstone/blue-moonstone-preview.png`,
            categoryId: 'blue-series',
          },
          {
            id: 'strawberry',
            name: '草莓晶',
            caption: '绯红 · 絮影',
            image: `${crystalRoot}/strawberry-crystal/strawberry-crystal-preview.png`,
            categoryId: 'pink-series',
          },
          {
            id: 'green-phantom',
            name: '绿幽灵',
            caption: '层叠 · 山影',
            image: `${crystalRoot}/green-phantom/green-phantom-preview.png`,
            categoryId: 'green-white-series',
          },
          {
            id: 'amethyst',
            name: '乌拉圭紫',
            caption: '浓郁 · 深透',
            image: `${crystalRoot}/uruguay-amethyst/uruguay-amethyst-preview.png`,
            categoryId: 'purple-series',
          },
        ],
      },
      featured: {
        eyebrow: 'NEW SELECTION',
        title: '精选新作',
        actionLabel: '查看全部',
        actionPath: '/pages/goods/goods',
        items: [
          {
            id: 'morganite',
            title: '摩根石',
            caption: '柔粉色调 · 8 / 10mm',
            image: `${shopRoot}/morganite-bracelet.jpg`,
            path: '/pages/goods/detail/detail?id=shop-morganite',
          },
          {
            id: 'white-crystal',
            title: '双 A 白水泡泡串',
            caption: '高净体白水晶 · 12mm',
            image: `${shopRoot}/white-bubble-wrist-detail.jpg`,
            path: '/pages/goods/detail/detail?id=shop-white-bubble-bracelet',
          },
          {
            id: 'silver-obsidian',
            title: '陨石银曜石',
            caption: '深色银点纹理 · 10 / 12mm',
            image: `${shopRoot}/silver-obsidian-bracelet.jpg`,
            path: '/pages/goods/detail/detail?id=shop-silver-obsidian',
          },
        ],
      },
    },
  },
  {
    key: 'diy',
    name: 'DIY 页面',
    content: {
      pageTitle: '珠岛设计台',
      canvasTitle: '3D DIY',
      canvasHint: '等待第一颗水晶',
      noticeLabel: '使用须知',
      saveLabel: '保存',
      finishLabel: '完成设计',
      selectHint: '请选择珠子',
      stageLabel: 'LIVE MATERIAL VIEW',
      stageHint: '转动、换珠、实时看见光线变化',
      experiencePoints: [
        { id: 'preview', label: '360° 实时预览' },
        { id: 'texture', label: '真实材质贴图' },
        { id: 'compose', label: '自由组合计价' },
      ],
      materialPreviews: [
        {
          id: 'moonstone',
          name: '蓝月光',
          image: `${crystalRoot}/blue-moonstone/blue-moonstone-preview.png`,
        },
        {
          id: 'strawberry',
          name: '草莓晶',
          image: `${crystalRoot}/strawberry-crystal/strawberry-crystal-preview.png`,
        },
        {
          id: 'green-phantom',
          name: '绿幽灵',
          image: `${crystalRoot}/green-phantom/green-phantom-preview.png`,
        },
        {
          id: 'amethyst',
          name: '乌拉圭紫',
          image: `${crystalRoot}/uruguay-amethyst/uruguay-amethyst-preview.png`,
        },
        {
          id: 'golden-rutile',
          name: '金发晶',
          image: `${crystalRoot}/golden-rutile/golden-rutile-preview.png`,
        },
      ],
    },
  },
  {
    key: 'support',
    name: '支持与政策',
    content: {
      helpTopics: [
        {
          id: 'custom',
          title: '定制与设计',
          desc: '手串设计、珠子尺寸、保存记录',
          items: [
            '在 DIY 页面可按材质分类选择珠子，保存后会出现在“我的设计”。',
            '系统会根据手围和珠子数量提示是否适合佩戴，手围过小时建议减少大尺寸珠子。',
            '广场作品可直接套用，也可以保存后再微调材质、尺寸和顺序。',
          ],
        },
        {
          id: 'goods',
          title: '商品与材质',
          desc: '水晶色差、棉絮、发丝、天然纹理',
          items: [
            '天然珠子会存在颜色、冰裂、棉絮、矿缺和纹路差异，页面图片用于展示整体效果。',
            '发晶、幽灵、虎眼等材质在不同光线下会出现不同反光和色带表现。',
            '散珠规格以商品页展示为准，混搭下单前可先联系客服确认库存。',
          ],
        },
        {
          id: 'order',
          title: '订单与售后',
          desc: '确认订单、改尺寸、售后处理',
          items: [
            '购物车和立即购买都会进入确认订单页，提交前请确认地址、规格和留言。',
            '改尺寸、补珠、重新穿线属于额外服务，可在好物页选择对应服务下单。',
            '收到商品后如需售后，请保留包装和商品照片，联系客服协助处理。',
          ],
        },
        {
          id: 'shipping',
          title: '配送与保养',
          desc: '发货时间、日常护理、消磁建议',
          items: [
            '定制类商品需要制作和复核，发货时间以订单页或客服通知为准。',
            '日常佩戴请避免长期接触汗液、香水、清洁剂和高温环境。',
            '水晶保养建议使用柔软布料擦拭，收纳时单独放置，减少磕碰。',
          ],
        },
      ],
      purchase: {
        heroKicker: 'NOTES OF PURCHASE',
        title: '水晶购买须知',
        subtitle: '天然晶石会有自己的纹理、光感和小脾气，下单前先确认这些细节。',
        contactText: '下单前可发送材质名称、手围和设计截图，客服会协助核对库存、色差和规格。',
        sections: [
          {
            id: 'texture',
            title: '天然纹理',
            subtitle: '每一颗都不是复制品',
            tone: 'texture',
            points: [
              '棉絮、冰裂、矿缺、色带和发丝属于天然晶石常见表现。',
              '同一材质不同批次会有深浅、通透度和内含物差异。',
              '手串最终会按实际珠子组合呈现，页面图用于辅助判断整体风格。',
            ],
          },
          {
            id: 'color',
            title: '色差说明',
            subtitle: '光线、屏幕和角度都会影响观感',
            tone: 'color',
            points: [
              '强光下晶体更透，弱光下颜色会更沉稳，虎眼、月光等材质角度差异更明显。',
              '手机屏幕亮度和色彩模式会带来轻微偏差。',
              '如需确认实物批次，可在下单前联系客服核对库存图。',
            ],
          },
          {
            id: 'size',
            title: '规格确认',
            subtitle: '珠径、手围和颗数会共同影响佩戴效果',
            tone: 'size',
            points: [
              '珠径越大，成串颗数越少，视觉存在感和重量也会更明显。',
              'DIY 页面会提示当前珠子数量和手围适配情况，请提交前核对。',
              '需要改尺寸、加配珠或特殊隔珠时，建议在订单备注中说明。',
            ],
          },
          {
            id: 'shipping',
            title: '下单与售后',
            subtitle: '定制商品会先核对再制作',
            tone: 'shipping',
            points: [
              '提交订单后会进入核对制作流程，部分稀有材质需确认库存。',
              '发货前如需调整设计，可尽快联系客服处理。',
              '收到商品后请保留包装和实物照片，便于售后沟通。',
            ],
          },
        ],
      },
      terms: {
        intro: '欢迎使用我们的小程序！ 在您使用本小程序之前，请认真阅读以下的用户服务协议（以下简称“本协议”）。',
        sections: [
          {
            title: '1. 服务条款',
            body: '本小程序由我们提供，为保证您的权益和安全，请您在使用本小程序前仔细阅读并同意本协议。若您不同意本协议，将无法使用本小程序提供的服务。',
          },
          {
            title: '2. 用户信息的收集和使用',
            body: '当您使用本小程序时，我们可能会收集和使用您的个人信息。我们承诺在合法、正当的范围内收集和使用您的个人信息，并采取合理的措施确保您的信息安全。',
          },
          {
            title: '3. 用户行为规范',
            body: '您应当遵守中华人民共和国相关法律法规以及本小程序的相关规定，不得利用本小程序从事任何违法或不良行为。',
          },
          {
            title: '4. 免责声明',
            body: '鉴于互联网的特殊性，本小程序无法对其他用户的行为进行完全的监控和控制。因此，我们无法对其他用户的行为负责，包括但不限于其他用户发布的任何内容。',
          },
          {
            title: '5. 协议的修改和更新',
            body: '我们有权随时修改和更新本协议，并在本小程序上公示。修改和更新后的协议一旦公示即生效。若您对修改和更新后的协议有异议，应当立即停止使用本小程序提供的服务。',
          },
          {
            title: '6. 法律适用和争议解决',
            body: '本协议的订立、执行和解释均应受中华人民共和国法律的管辖。如您和我们就本协议内容或其执行发生任何争议，应当通过友好协商解决；协商不成的，应当提交有管辖权的人民法院进行诉讼。',
          },
          {
            title: '7. 其他条款',
            body: '本协议构成您与我们之间关于使用本小程序的完整协议，除本协议外，我们未向您做出任何陈述或承诺。如本协议中的任何条款无效或不可执行，不影响其他条款的效力。',
          },
        ],
      },
    },
  },
];

export const ADDITIVE_PAGE_DEFAULTS: Record<string, PageContent> = {
  brand: {
    supportId: 'ZHUDAO',
    supportHours: '工作日 10:00-19:00',
  },
  diy: {
    pageTitle: '珠岛设计台',
    canvasTitle: '3D DIY',
    canvasHint: '等待第一颗水晶',
    noticeLabel: '使用须知',
    saveLabel: '保存',
    finishLabel: '完成设计',
    selectHint: '请选择珠子',
  },
};

export const LEGACY_DEFAULT_PAGE_CONFIGS: DefaultPageConfig[] = [
  {
    key: 'brand',
    name: '品牌信息',
    content: {
      name: '养个石头',
      logoText: '养个石头',
      slogan: '让每一颗石头，成为你的日常陪伴',
      logoImage: '',
      serviceEmail: '',
      servicePhone: '',
    },
  },
  {
    key: 'home',
    name: '首页内容',
    content: {
      tiles: [
        { id: 'diy', label: 'DIY-CUSTOM', sub: '设计手串', image: '', path: '/pages/design/design' },
        { id: 'goods', label: 'DESIGN-PLAZA', sub: '设计广场', image: '', path: '/pages/goods/goods' },
      ],
      banners: [{ id: 'b1', image: '', link: '' }],
      designs: [
        { id: 'd1', title: '菩提蛋糕', author: '@吴烦恼', image: '', cta: '查看实物' },
        { id: 'd2', title: '怒目绿龙', author: '@Oo', image: '', cta: '查看实物' },
      ],
    },
  },
  {
    key: 'diy',
    name: 'DIY 页面',
    content: {
      title: '设计你的专属手串',
      subtitle: '挑选喜欢的珠子，自由组合独一无二的作品',
      guideTitle: '从一颗珠子开始',
      guideDescription: '选择材质与尺寸，预览搭配效果并保存你的设计。',
      startButtonText: '开始设计',
      emptyHint: '还没有添加珠子',
      tips: ['先确定主色，再选择点缀色', '不同尺寸搭配会更有层次'],
    },
  },
];

export function getDefaultPageContent<T>(key: string): T {
  const config = DEFAULT_PAGE_CONFIGS.find((item) => item.key === key);
  if (!config) {
    throw new Error(`Missing default page config: ${key}`);
  }
  return JSON.parse(JSON.stringify(config.content)) as T;
}
