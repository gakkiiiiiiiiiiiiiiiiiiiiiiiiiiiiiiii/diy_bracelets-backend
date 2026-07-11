import { Injectable } from '@nestjs/common';
import {
  BrandContent,
  getDefaultPageContent,
  HomeContent,
} from '../content/content.defaults';
import { ContentService } from '../content/content.service';

@Injectable()
export class HomeService {
  constructor(private readonly contentService: ContentService) {}

  async getHome() {
    const defaultBrand = getDefaultPageContent<BrandContent>('brand');
    const defaultHome = getDefaultPageContent<HomeContent>('home');
    const [brand, home] = await Promise.all([
      this.contentService.getPublishedContent('brand', defaultBrand),
      this.contentService.getPublishedContent('home', defaultHome),
    ]);

    const legacyHome = home as HomeContent & {
      tiles?: Array<{ id: string; label: string; sub: string; image: string; path: string }>;
      banners?: Array<{ id: string; image: string; link: string }>;
      designs?: Array<{ id: string; title: string; author: string; image: string; cta: string }>;
    };
    const hero = {
      ...defaultHome.hero,
      ...(legacyHome.hero ?? {}),
      primaryAction: {
        ...defaultHome.hero.primaryAction,
        ...(legacyHome.hero?.primaryAction ?? {}),
      },
    };
    const featured = {
      ...defaultHome.featured,
      ...(legacyHome.featured ?? {}),
      items: legacyHome.featured?.items?.length
        ? legacyHome.featured.items
        : defaultHome.featured.items,
    };

    return {
      logoText: brand.name || defaultBrand.name,
      tiles: legacyHome.tiles?.length
        ? legacyHome.tiles
        : [
            { id: 'diy', label: '3D-DIY', sub: '开始设计', image: hero.image, path: hero.primaryAction.path },
            { id: 'goods', label: 'NEW-SELECTION', sub: featured.title, image: '', path: featured.actionPath },
          ],
      banners: legacyHome.banners?.length
        ? legacyHome.banners
        : [{ id: 'hero', image: hero.image, link: hero.primaryAction.path }],
      designs: legacyHome.designs?.length
        ? legacyHome.designs
        : featured.items.map((item) => ({
            id: item.id,
            title: item.title,
            author: item.caption,
            image: item.image,
            cta: featured.actionLabel,
          })),
    };
  }
}
