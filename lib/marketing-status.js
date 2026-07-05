// Bir ürünün pazarlama hazırlık durumu — dashboard rozeti + filtresi için.
// Sunucu tarafı (fs okur): brief onayı, reklam metni, görsel, video, creative seti, kampanya.
import { readBrief } from './brief.js';
import { listCreatives, readConfig } from './reklam.js';

// content: data/content.json'daki o slug'ın kaydı (getContent/readAllContent'ten).
export function marketingStatus(product, content) {
  const brief = readBrief(product.slug);
  const creatives = listCreatives(product.slug);
  const config = readConfig(product.slug);

  const steps = {
    brief: Boolean(brief?.approved),                              // onaylı brief
    copy: Boolean(content?.copy),                                 // reklam metni
    gorsel: Boolean(content?.gorsel?.localPath || content?.gorsel?.url),
    video: Boolean(content?.video?.url),
    creative: creatives.length > 0,                              // markalı creative seti
    campaign: Boolean(config?.campaign),                          // Meta kampanya config'i
  };

  // "Reklama hazır" = onaylı brief + metin + (görsel veya creative). Kampanya ayrı ölçülür.
  const ready = steps.brief && steps.copy && (steps.gorsel || steps.creative);
  const done = Object.values(steps).filter(Boolean).length;

  return {
    steps,
    ready,
    hasAny: done > 0,
    done,
    total: Object.keys(steps).length,
    creativesCount: creatives.length,
  };
}

// Filtre anahtarı → ürün gösterilsin mi? (dashboard ?durum= parametresi)
export function matchesFilter(filter, status, product) {
  const onSite = Boolean(product.website && !product.website.removedFromSite);
  switch (filter) {
    case 'eksik':   return onSite && !status.ready;          // sitede yayında ama reklama hazır değil
    case 'hazir':   return status.ready;                     // reklama hazır
    case 'kampanya-yok': return status.ready && !status.steps.campaign; // hazır ama kampanyası yok
    case 'site':    return onSite;                           // web sitesine bağlı
    case 'kaldirildi': return Boolean(product.website?.removedFromSite); // sitede yok, panelde duruyor
    default:        return true;                             // hepsi
  }
}

export const FILTERS = [
  { key: 'all',          label: 'Tümü' },
  { key: 'eksik',        label: 'Reklamı Eksik' },
  { key: 'kampanya-yok', label: 'Hazır · Kampanyasız' },
  { key: 'hazir',        label: 'Reklama Hazır' },
  { key: 'site',         label: 'Sitede Yayında' },
  { key: 'kaldirildi',   label: 'Siteden Kaldırıldı' },
];
