import { NextResponse } from 'next/server';
import { tiktokConfigured, youtubeConfigured } from '@/lib/tiktok-youtube-publish';

// Bağlı Hesaplar paneli + Takvim'in "otomatik yayın/assisted" rozeti bunu okur.
// Yalnız env DEĞİŞKENİ varlığını raporlar — "dolu ≠ doğru" (bkz. sir-yonetimi yeteneği):
// bir kimlik BOŞ değilse "yapılandırılmış" sayılır, GEÇERLİ/güncel olduğu ayrıca
// kanıtlanmaz (token süresi dolmuş olabilir, ilk gerçek yayın denemesi ortaya çıkarır).
export async function GET() {
  const meta = Boolean(process.env.META_ACCESS_TOKEN);
  const icerikAjani = Boolean(process.env.ICERIK_AJANI_URL);
  return NextResponse.json({
    ok: true,
    hesaplar: {
      instagram: { configured: meta && Boolean(process.env.META_IG_BUSINESS_ID), yontem: 'Meta Graph API' },
      facebook: { configured: meta && Boolean(process.env.META_PAGE_ID), yontem: 'Meta Graph API' },
      tiktok: { configured: tiktokConfigured(), yontem: 'TikTok Content Posting API' },
      youtube: { configured: youtubeConfigured(), yontem: 'YouTube Data API v3' },
      linkedin: { configured: icerikAjani, yontem: 'Sosyal Yayın Servisi köprüsü (4173)' },
      x: { configured: icerikAjani, yontem: 'Sosyal Yayın Servisi köprüsü (4173)' },
    },
  });
}
