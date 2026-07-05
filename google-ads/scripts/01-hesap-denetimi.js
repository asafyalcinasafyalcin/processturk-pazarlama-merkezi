/**
 * ProcessTürk — Google Ads Hesap Denetimi (v1)
 * ------------------------------------------------------------
 * NE YAPAR: Hesaptaki tüm kampanyaları + türlerini + durumlarını + son 30 gün
 *           performansını listeler; tanımlı dönüşüm aksiyonlarını ve hesap
 *           ayarlarını (para birimi, saat dilimi) raporlar.
 * NE YAPMAZ: HİÇBİR DEĞİŞİKLİK yapmaz — yalnızca okur. Güvenle çalıştırılabilir.
 *
 * KULLANIM (kurulum yükü ~2 dk, geliştirici token / OAuth GEREKMEZ):
 *   Google Ads → Araçlar (üst menü) → Toplu işlemler → Komut dosyaları
 *   → (+) Yeni komut dosyası → bu kodun tamamını yapıştır
 *   → "Yetkilendir" (bir kez, kendi hesabın için) → "Önizle" veya "Çalıştır"
 *   → Alttaki "Günlükler" (Logs) sekmesindeki çıktının TAMAMINI kopyalayıp Claude'a ver.
 *
 * Bu çıktı, hangi eski kampanyaların arşivleneceğini ve dönüşüm takibinin
 * kurulu olup olmadığını netleştirir → yeni kampanya planının girdisidir.
 */
function main() {
  Logger.log('===== PROCESSTÜRK · GOOGLE ADS HESAP DENETİMİ =====');
  Logger.log('Tarih: ' + Utilities.formatDate(new Date(), AdsApp.currentAccount().getTimeZone(), 'yyyy-MM-dd HH:mm'));

  // --- 1) Hesap bilgisi ---
  try {
    var acc = AdsApp.currentAccount();
    Logger.log('\nHesap: ' + acc.getName() + ' (' + acc.getCustomerId() + ')');
    var custRows = AdsApp.search(
      'SELECT customer.currency_code, customer.time_zone, customer.descriptive_name FROM customer LIMIT 1');
    while (custRows.hasNext()) {
      var c = custRows.next();
      Logger.log('Para birimi: ' + c.customer.currencyCode + '  ·  Saat dilimi: ' + c.customer.timeZone);
    }
  } catch (e) { Logger.log('[!] Hesap bilgisi okunamadı: ' + e); }

  // --- 2) Tüm kampanyalar (aktivite olmasa da hepsi) ---
  Logger.log('\n----- KAMPANYALAR (tümü) -----');
  var typeCount = {};
  try {
    var inv = AdsApp.search(
      'SELECT campaign.id, campaign.name, campaign.advertising_channel_type, ' +
      'campaign.advertising_channel_sub_type, campaign.status ' +
      'FROM campaign ORDER BY campaign.advertising_channel_type');
    var count = 0;
    while (inv.hasNext()) {
      var r = inv.next();
      var t = r.campaign.advertisingChannelType || '?';
      var sub = r.campaign.advertisingChannelSubType || '';
      typeCount[t] = (typeCount[t] || 0) + 1;
      Logger.log('• [' + t + (sub ? '/' + sub : '') + '] ' + r.campaign.name +
        '  — durum: ' + r.campaign.status + '  (id ' + r.campaign.id + ')');
      count++;
    }
    Logger.log('Toplam kampanya: ' + count);
    Logger.log('Tür dağılımı: ' + JSON.stringify(typeCount));
    if ((typeCount['MULTI_CHANNEL'] || 0) > 0) {
      Logger.log('[ARŞİV ADAYI] App/Multi-channel kampanya(lar) bulundu → yeni lead/marka hedefi için arşivlenecek.');
    }
  } catch (e) { Logger.log('[!] Kampanya envanteri okunamadı: ' + e); }

  // --- 3) Son 30 gün performans ---
  Logger.log('\n----- SON 30 GÜN PERFORMANS -----');
  try {
    var perf = AdsApp.search(
      'SELECT campaign.name, metrics.cost_micros, metrics.impressions, metrics.clicks, ' +
      'metrics.conversions FROM campaign WHERE segments.date DURING LAST_30_DAYS ' +
      'ORDER BY metrics.cost_micros DESC');
    var any = false;
    while (perf.hasNext()) {
      var p = perf.next();
      any = true;
      var cost = (p.metrics.costMicros ? Number(p.metrics.costMicros) : 0) / 1000000;
      Logger.log('• ' + p.campaign.name + '  — maliyet: ' + cost.toFixed(2) +
        '  · gösterim: ' + p.metrics.impressions +
        '  · tıklama: ' + p.metrics.clicks +
        '  · dönüşüm: ' + p.metrics.conversions);
    }
    if (!any) Logger.log('Son 30 günde harcama/gösterim yok (hesap yeni aktifleşti — beklenen durum).');
  } catch (e) { Logger.log('[!] Performans okunamadı: ' + e); }

  // --- 4) Dönüşüm takibi ---
  Logger.log('\n----- DÖNÜŞÜM TAKİBİ (lead ölçümü için kritik) -----');
  try {
    var conv = AdsApp.search(
      'SELECT conversion_action.name, conversion_action.status, conversion_action.type, ' +
      'conversion_action.category FROM conversion_action ORDER BY conversion_action.status');
    var cAny = false;
    while (conv.hasNext()) {
      var ca = conv.next();
      cAny = true;
      Logger.log('• ' + ca.conversionAction.name + '  — durum: ' + ca.conversionAction.status +
        '  · tür: ' + ca.conversionAction.type + '  · kategori: ' + ca.conversionAction.category);
    }
    if (!cAny) Logger.log('[!] TANIMLI DÖNÜŞÜM YOK → lead ölçümü için dönüşüm aksiyonu kurmamız gerekecek.');
  } catch (e) { Logger.log('[!] Dönüşüm aksiyonları okunamadı: ' + e); }

  Logger.log('\n===== DENETİM BİTTİ — bu günlüklerin TAMAMINI kopyalayıp Claude\'a ver =====');
}
