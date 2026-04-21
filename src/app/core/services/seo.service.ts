import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

type SeoConfig = {
  title: string;
  description: string;
  path?: string;
  image?: string;
};

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  setPageMeta(config: SeoConfig): void {
    const canonicalUrl = this.buildUrl(config.path);
    const imageUrl = config.image ? this.buildUrl(config.image) : canonicalUrl;

    this.title.setTitle(config.title);

    this.meta.updateTag({
      name: 'description',
      content: config.description,
    });
    this.meta.updateTag({
      property: 'og:title',
      content: config.title,
    });
    this.meta.updateTag({
      property: 'og:description',
      content: config.description,
    });
    this.meta.updateTag({
      property: 'og:type',
      content: 'website',
    });
    this.meta.updateTag({
      property: 'og:url',
      content: canonicalUrl,
    });
    this.meta.updateTag({
      property: 'og:image',
      content: imageUrl,
    });
    this.meta.updateTag({
      name: 'twitter:card',
      content: 'summary_large_image',
    });
    this.meta.updateTag({
      name: 'twitter:title',
      content: config.title,
    });
    this.meta.updateTag({
      name: 'twitter:description',
      content: config.description,
    });
    this.meta.updateTag({
      name: 'twitter:image',
      content: imageUrl,
    });

    this.updateCanonical(canonicalUrl);
  }

  private buildUrl(path = ''): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const origin = this.document.location?.origin ?? '';
    return path ? `${origin}${normalizedPath}` : `${origin}/`;
  }

  private updateCanonical(url: string): void {
    let link = this.document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }

    link.setAttribute('href', url);
  }
}
