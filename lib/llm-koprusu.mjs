// ⚠️ ÜRETİLMİŞ DOSYA — ELLE DÜZENLEME.
// Kaynak: Temel_Sistemler/llm-koprusu/llm.mjs
// Güncelleme: kaynağa yaz → node Temel_Sistemler/kopruyu-dagit.mjs --uygula
// Elle yapılan değişiklik bir sonraki dağıtımda SESSİZCE kaybolur.
// ============================================================================
// LLM KÖPRÜSÜ — tüm metin/embedding çağrılarının tek kapısı
// ============================================================================
// KAYNAK DOSYA: Temel_Sistemler/llm-koprusu/llm.mjs
// Bu dosyanın kopyaları projelere `koprüyü-dagit.mjs` ile dağıtılır.
// ⚠️ KOPYAYI ELLE DÜZENLEME — kaynağa yaz, sonra dağıt (sirlari-dagit.mjs deseni).
//
// SORUN (2026-07-19 envanteri): 25+ projede ~48 bağımsız OpenAI çağrı noktası
// vardı. Her biri kendi `fetch("https://api.openai.com/...")` satırını, kendi
// anahtar okumasını, kendi hata mesajını ve kendi model env adını taşıyordu
// (15 farklı model env adı!). Sağlayıcı değiştirmek 48 dosya düzenlemek demekti;
// bir hatayı düzeltmek 48 kez düzeltmek demekti.
//
// ÇÖZÜM: Tek modül, tek imza, sağlayıcı env'den seçilir.
//
// TEMEL KURAL — DAVRANIŞ DEĞİŞMEZ: Köprü varsayılan olarak bugünkü davranışı
// birebir korur (OpenAI + projenin mevcut modeli). Sağlayıcı değişimi ancak
// açıkça env verilince olur. Göç sırasında hiçbir projenin çıktısı değişmemeli.
//
// KAPSAM: metin (sohbet) + embedding. GÖRSEL/VİDEO/TTS KAPSAM DIŞI —
// onların tek kaynağı Processturk_Pazarlama_Merkezi/lib/providers/gen.js'tir
// (cap-bazlı router). Sebep: OpenRouter/Anthropic bu yetenekleri sunmuyor,
// medya yönlendirmesi tamamen farklı bir problem.
//
// KULLANIM:
//   import { sohbet } from "./llm.mjs";
//   const { metin } = await sohbet({ mesajlar: [{ rol: "kullanici", icerik: "merhaba" }] });
//   const { json }  = await sohbet({ mesajlar, json: true });   // JSON modu
//
// ENV:
//   LLM_SAGLAYICI      openai (varsayılan) | openrouter | anthropic | fal
//   OPENAI_API_KEY / OPENROUTER_API_KEY / ANTHROPIC_API_KEY / FAL_KEY
//   LLM_MODEL          köprü genel varsayılanı (proje env'i öncelikli — aşağıya bak)
// ============================================================================

export class LLMHatasi extends Error {
  constructor(mesaj, { saglayici, durum, govde } = {}) {
    super(mesaj);
    this.name = "LLMHatasi";
    this.saglayici = saglayici;
    this.durum = durum;      // HTTP durum kodu (varsa)
    this.govde = govde;      // ham yanıt (kısaltılmış)
  }
}

// ── Model env adı normalizasyonu ─────────────────────────────────────────────
// Üretimde 15 farklı model env adı var (OPENAI_MODEL, OPENAI_TEXT_MODEL,
// COPILOT_MODEL, CHATBOT_LLM_MODEL, OPENAI_TRANSLATE_MODEL...). Göçte bunları
// tek isme indirmek deploy'ları kırardı — çünkü VPS .env'lerinde eski adlar var.
// Bu yüzden köprü ESKİ ADLARI DA OKUR.
//
// ⚠️ SAĞLAYICIYA ÖZEL OLMAK ZORUNDA: model adları sağlayıcılar arasında taşınmaz
// ("gpt-4.1-mini" fal'da geçersiz, OpenRouter'da "openai/" öneki ister). Liste
// ortak tutulunca OPENAI_MODEL fal çağrısına sızıp 422 verdi — duman testinde
// yakalandı (2026-07-19). Her sağlayıcı YALNIZ kendi env adlarını görür.
const MODEL_ENV_SIRASI = {
  // LLM_MODEL: operatörün açık ezmesi — seçili sağlayıcıya uygun olması ONUN sorumluluğu.
  openai: ["LLM_MODEL", "OPENAI_MODEL", "OPENAI_TEXT_MODEL", "CHATBOT_LLM_MODEL", "COPILOT_MODEL"],
  openrouter: ["LLM_MODEL", "OPENROUTER_MODEL"],
  anthropic: ["LLM_MODEL", "ANTHROPIC_MODEL"],
  fal: ["LLM_MODEL", "FAL_LLM_MODEL"],
};

function ortam() {
  // Next.js edge/tarayıcı ortamında process olmayabilir — güvenli erişim.
  return (typeof process !== "undefined" && process.env) ? process.env : {};
}

function ilkDolu(adlar, env) {
  for (const a of adlar) if (env[a]) return env[a];
  return null;
}

// ── Sağlayıcı tanımları ──────────────────────────────────────────────────────
// Her sağlayıcı: anahtar env'i, taban URL, varsayılan model, istek/yanıt biçimi.
// openai ve openrouter aynı sözleşmeyi (chat/completions) konuşur — bu yüzden
// OpenRouter'a geçiş gerçekten tek env satırıdır.
const SAGLAYICILAR = {
  openai: {
    ad: "openai",
    anahtarEnv: ["OPENAI_API_KEY"],
    taban: "https://api.openai.com/v1",
    varsayilanModel: "gpt-4.1-mini",
    bicim: "openai",
  },
  openrouter: {
    ad: "openrouter",
    anahtarEnv: ["OPENROUTER_API_KEY"],
    taban: "https://openrouter.ai/api/v1",
    // OpenRouter model adları sağlayıcı önekli olmak zorunda.
    varsayilanModel: "openai/gpt-4.1-mini",
    bicim: "openai",
    ekBaslik: (env) => ({
      // OpenRouter sıralama/atıf için ister; zorunlu değil ama önerilir.
      "HTTP-Referer": env.OPENROUTER_SITE || "https://processturk.com",
      "X-Title": env.OPENROUTER_UYGULAMA || "ProcessTurk",
    }),
  },
  anthropic: {
    ad: "anthropic",
    anahtarEnv: ["ANTHROPIC_API_KEY"],
    taban: "https://api.anthropic.com/v1",
    varsayilanModel: "claude-sonnet-4-6",
    bicim: "anthropic",
  },
  fal: {
    // fal any-llm: web sitesinde ve Video Maker'da zaten yedek yol olarak kullanılıyor.
    ad: "fal",
    anahtarEnv: ["FAL_KEY"],
    taban: "https://fal.run/fal-ai/any-llm",
    varsayilanModel: "openai/gpt-4o-mini",
    bicim: "fal",
  },
};

function saglayiciSec(istenen, env) {
  const ad = (istenen || env.LLM_SAGLAYICI || "openai").toLowerCase();
  const s = SAGLAYICILAR[ad];
  if (!s) {
    throw new LLMHatasi(
      `Bilinmeyen sağlayıcı: "${ad}". Geçerli: ${Object.keys(SAGLAYICILAR).join(", ")}`,
      { saglayici: ad },
    );
  }
  return s;
}

function anahtarAl(s, env) {
  const k = ilkDolu(s.anahtarEnv, env);
  if (!k) {
    throw new LLMHatasi(
      `${s.ad} için anahtar yok — ${s.anahtarEnv.join(" veya ")} tanımlı değil.`,
      { saglayici: s.ad },
    );
  }
  return k;
}

// ── Mesaj normalizasyonu ─────────────────────────────────────────────────────
// Köprü Türkçe rol adları kullanır (sistem/kullanici/asistan) ama İngilizce
// (system/user/assistant) de kabul eder — göçte 48 dosyayı tek tek çevirmek
// yerine mevcut dizileri olduğu gibi geçirebilmek için.
const ROL_ESLEME = {
  sistem: "system", system: "system",
  kullanici: "user", user: "user",
  asistan: "assistant", assistant: "assistant",
  arac: "tool", tool: "tool",
};

function mesajlariNormalize(mesajlar, sistem) {
  const out = [];
  if (sistem) out.push({ role: "system", content: sistem });
  for (const m of (mesajlar || [])) {
    const rol = ROL_ESLEME[(m.rol || m.role || "").toLowerCase()];
    if (!rol) throw new LLMHatasi(`Geçersiz mesaj rolü: ${m.rol || m.role}`);
    const icerik = m.icerik != null ? m.icerik : m.content;
    // Araç çağıran asistan mesajında content null OLABİLİR (OpenAI sözleşmesi).
    if (icerik == null && !m.tool_calls && !m.araciCagrilari) {
      throw new LLMHatasi("Mesaj içeriği boş olamaz");
    }
    const y = { role: rol, content: icerik ?? null };
    // Tool calling alanları KORUNMALI — normalizasyon bunları düşürürse araç
    // konuşması kırılır (asistanın çağrısı ve aracın yanıtı eşleşmez).
    const cagrilar = m.tool_calls || m.araciCagrilari;
    if (cagrilar) y.tool_calls = cagrilar;
    const cagriId = m.tool_call_id || m.aracCagriId;
    if (cagriId) y.tool_call_id = cagriId;
    if (m.name) y.name = m.name;
    out.push(y);
  }
  if (!out.length) throw new LLMHatasi("En az bir mesaj gerekli");
  return out;
}

// ── Ortak HTTP ───────────────────────────────────────────────────────────────
async function istek(url, { basliklar, govde, zamanAsimi, saglayici, denemeler, fetchImpl }) {
  // fetchImpl: test harness'ları global fetch'i değiştirmek zorunda kalmasın diye
  // enjekte edilebilir. Verilmezse global fetch kullanılır (üretim yolu).
  const cagir = fetchImpl || fetch;
  let sonHata;
  for (let i = 0; i <= denemeler; i++) {
    try {
      const res = await cagir(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...basliklar },
        body: JSON.stringify(govde),
        signal: AbortSignal.timeout(zamanAsimi),
      });
      const metin = await res.text();
      if (!res.ok) {
        // 429/5xx geçici → yeniden dene. 4xx kalıcı → hemen at.
        const gecici = res.status === 429 || res.status >= 500;
        const hata = new LLMHatasi(
          `${saglayici} API ${res.status}: ${metin.slice(0, 300)}`,
          { saglayici, durum: res.status, govde: metin.slice(0, 1000) },
        );
        if (!gecici || i === denemeler) throw hata;
        sonHata = hata;
        await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
        continue;
      }
      try { return JSON.parse(metin); }
      catch { throw new LLMHatasi(`${saglayici}: yanıt JSON değil: ${metin.slice(0, 200)}`, { saglayici }); }
    } catch (e) {
      if (e instanceof LLMHatasi && e.durum && e.durum < 500 && e.durum !== 429) throw e;
      if (i === denemeler) throw (e instanceof LLMHatasi ? e : new LLMHatasi(`${saglayici}: ${e.message}`, { saglayici }));
      sonHata = e;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, i)));
    }
  }
  throw sonHata;
}

/**
 * Metin üretimi — tüm projelerin tek sohbet kapısı.
 *
 * @param {object} p
 * @param {Array}  p.mesajlar   [{ rol:'sistem'|'kullanici'|'asistan', icerik }]
 * @param {string} [p.sistem]   kısayol: başa sistem mesajı ekler
 * @param {string} [p.model]    açık model adı (env'i ezer)
 * @param {string[]} [p.modelEnv] bu çağrının kendi model env adları (en öncelikli)
 * @param {boolean|object} [p.json] true → JSON nesnesi zorla; obje → JSON şeması
 * @param {number} [p.sicaklik]
 * @param {number} [p.maxToken]
 * @param {any[]} [p.araclar] tool/function tanımları (OpenAI biçimi) — yalnız openai/openrouter
 * @param {any} [p.aracSecimi] tool_choice
 * @param {string} [p.saglayici] tek seferlik sağlayıcı ezmesi
 * @param {number} [p.zamanAsimi=60000]
 * @param {number} [p.denemeler=2] geçici hatada yeniden deneme sayısı
 * @param {object} [p.env] env ezmesi (test için)
 * @returns {Promise<{metin:string, json:any, model:string, saglayici:string,
 *   kullanim:object, araciCagrilari?:any[]|null, bitisSebebi?:string|null, hamMesaj?:any}>}
 */
export async function sohbet({
  mesajlar, sistem, model, modelEnv, json, sicaklik, maxToken,
  araclar, aracSecimi,
  saglayici, zamanAsimi = 60000, denemeler = 2, env: envOzel, fetchImpl,
} = {}) {
  const env = envOzel || ortam();
  const s = saglayiciSec(saglayici, env);
  const anahtar = anahtarAl(s, env);
  const msj = mesajlariNormalize(mesajlar, sistem);

  // Model seçimi: açık parametre > çağrının özel env'i > sağlayıcının env'leri > varsayılanı
  const secilenModel = model
    || ilkDolu([...(modelEnv || []), ...(MODEL_ENV_SIRASI[s.ad] || [])], env)
    || s.varsayilanModel;

  if (s.bicim === "anthropic") {
    // Anthropic ayrı şema: sistem mesajı gövdenin dışında, üst seviye alan.
    const sistemMesaji = msj.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const kalan = msj.filter((m) => m.role !== "system");
    const govde = {
      model: secilenModel,
      max_tokens: maxToken || 4096,
      messages: kalan,
      ...(sistemMesaji ? { system: sistemMesaji } : {}),
      ...(sicaklik != null ? { temperature: sicaklik } : {}),
    };
    const y = await istek(`${s.taban}/messages`, {
      basliklar: { "x-api-key": anahtar, "anthropic-version": "2023-06-01" },
      govde, zamanAsimi, saglayici: s.ad, denemeler, fetchImpl,
    });
    const metin = (y.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    return paketle(metin, json, secilenModel, s.ad, {
      girdi: y.usage?.input_tokens ?? null, cikti: y.usage?.output_tokens ?? null,
    });
  }

  if (s.bicim === "fal") {
    // fal any-llm: tek prompt alanı; sistem ayrı. Rol geçmişi düzleştirilir.
    const sistemMesaji = msj.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const prompt = msj.filter((m) => m.role !== "system")
      .map((m) => (m.role === "assistant" ? `Asistan: ${m.content}` : m.content)).join("\n\n");
    const y = await istek(s.taban, {
      basliklar: { Authorization: `Key ${anahtar}` },
      govde: { model: secilenModel, prompt, ...(sistemMesaji ? { system_prompt: sistemMesaji } : {}) },
      zamanAsimi, saglayici: s.ad, denemeler, fetchImpl,
    });
    return paketle(y.output || "", json, secilenModel, s.ad, { girdi: null, cikti: null });
  }

  // openai / openrouter — aynı sözleşme
  //
  // ⚠️ TOKEN ALANI MODELE GÖRE DEĞİŞİR: yeni nesil modeller (gpt-5*, o1/o3/o4)
  // `max_tokens`'ı REDDEDER — "Unsupported parameter: 'max_tokens' is not supported
  // with this model. Use 'max_completion_tokens' instead." (SafeFoodTR'da gpt-5.5
  // ile canlı doğrulandı). Eski modeller ise `max_completion_tokens` bilmez.
  const yeniNesil = /^(gpt-5|o1|o3|o4)/i.test(secilenModel)
    || /\/(gpt-5|o1|o3|o4)/i.test(secilenModel);   // OpenRouter "openai/gpt-5…" biçimi
  const tokenAlani = maxToken
    ? (yeniNesil ? { max_completion_tokens: maxToken } : { max_tokens: maxToken })
    : {};
  const govde = {
    model: secilenModel,
    messages: msj,
    // Yeni nesil modeller çoğunlukla yalnız varsayılan sıcaklığı kabul eder;
    // sicaklik açıkça verilmediyse hiç gönderilmez (mevcut davranış korunur).
    ...(sicaklik != null ? { temperature: sicaklik } : {}),
    ...tokenAlani,
    ...(araclar ? { tools: araclar } : {}),
    ...(aracSecimi ? { tool_choice: aracSecimi } : {}),
  };
  if (json) {
    govde.response_format = (typeof json === "object" && json !== null)
      ? { type: "json_schema", json_schema: json }
      : { type: "json_object" };
    // json_object modunda API "json" kelimesinin mesajlarda geçmesini şart koşar
    // (yoksa 400). Çok parçalı (vision) içerikte content bir DİZİ olduğu için
    // String(m.content) "[object Object]" verir ve kontrol yanlışlıkla eşleşmez
    // → gereksiz sistem mesajı enjekte edilirdi. Parçaların metnine bakılır.
    const metinIcerik = (c) => {
      if (typeof c === "string") return c;
      if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : (p?.text ?? ""))).join(" ");
      return "";
    };
    if (govde.response_format.type === "json_object"
      && !msj.some((m) => /json/i.test(metinIcerik(m.content)))) {
      govde.messages = [{ role: "system", content: "Yanıtı geçerli JSON olarak ver." }, ...msj];
    }
  }
  const basliklar = { Authorization: `Bearer ${anahtar}`, ...(s.ekBaslik ? s.ekBaslik(env) : {}) };
  const y = await istek(`${s.taban}/chat/completions`, {
    basliklar, govde, zamanAsimi, saglayici: s.ad, denemeler, fetchImpl,
  });
  const mesaj = y.choices?.[0]?.message || {};
  const metin = mesaj.content ?? "";
  const cagrilar = mesaj.tool_calls || null;
  // Model araç çağırdıysa content boş gelir — bu durumda json ayrıştırması
  // ZORLANMAZ, yoksa "ayrıştırılamadı" hatası araç akışını kırardı.
  const r = paketle(metin, cagrilar ? false : json, secilenModel, s.ad, {
    girdi: y.usage?.prompt_tokens ?? null, cikti: y.usage?.completion_tokens ?? null,
  });
  r.araciCagrilari = cagrilar;
  r.bitisSebebi = y.choices?.[0]?.finish_reason ?? null;
  r.hamMesaj = mesaj;   // araç konuşmasını sürdürmek için geri beslenir
  return r;
}

function paketle(metin, json, model, saglayici, kullanim) {
  let ayrisan = null;
  if (json) {
    try { ayrisan = JSON.parse(metin); }
    catch {
      // Bazı modeller JSON'u ```json bloğuna sarar — kurtarmayı dene.
      const m = /```(?:json)?\s*([\s\S]*?)```/.exec(metin) || /(\{[\s\S]*\}|\[[\s\S]*\])/.exec(metin);
      if (m) { try { ayrisan = JSON.parse(m[1]); } catch { /* kurtarılamadı */ } }
      if (ayrisan === null) {
        throw new LLMHatasi(`JSON istendi ama ayrıştırılamadı: ${metin.slice(0, 200)}`, { saglayici });
      }
    }
  }
  return { metin, json: ayrisan, model, saglayici, kullanim };
}

/**
 * Embedding — Intelligence Hub'ın pgvector indeksi bunu kullanır.
 * ⚠️ Yalnız OpenAI: OpenRouter embedding SUNMUYOR. Sağlayıcı openrouter'a
 * çevrilse bile embedding OpenAI'da kalır (aksi halde Hub sessizce bozulur).
 *
 * Vektörler `data[].index`'e göre SIRALANIR — girdi sırasıyla birebir eşleşir
 * (pgvector indeksinde sıra kritiktir).
 *
 * @param {object} p
 * @param {string[]|string} p.girdiler metin(ler); boş dizide ağa çıkılmaz
 * @param {string} [p.model] varsayılan: EMBEDDING_MODEL env → text-embedding-3-small
 * @param {number} [p.zamanAsimi=60000]
 * @param {number} [p.denemeler=2] geçici hatada yeniden deneme (0 = kapalı)
 * @param {object} [p.env] env ezmesi
 * @returns {Promise<{vektorler:number[][], model:string|null, kullanim?:object}>}
 */
export async function gomme({
  girdiler, model, zamanAsimi = 60000, denemeler = 2, env: envOzel, fetchImpl,
} = {}) {
  const env = envOzel || ortam();
  const anahtar = ilkDolu(["OPENAI_API_KEY"], env);
  if (!anahtar) throw new LLMHatasi("Embedding için OPENAI_API_KEY gerekli", { saglayici: "openai" });
  const dizi = Array.isArray(girdiler) ? girdiler : [girdiler];
  if (!dizi.length) return { vektorler: [], model: null };
  const secilenModel = model || env.EMBEDDING_MODEL || "text-embedding-3-small";
  const y = await istek("https://api.openai.com/v1/embeddings", {
    basliklar: { Authorization: `Bearer ${anahtar}` },
    govde: { model: secilenModel, input: dizi },
    zamanAsimi, saglayici: "openai", denemeler, fetchImpl,
  });
  return {
    vektorler: (y.data || []).sort((a, b) => a.index - b.index).map((d) => d.embedding),
    model: secilenModel,
    kullanim: { girdi: y.usage?.prompt_tokens ?? null },
  };
}

/** Hangi sağlayıcı/model aktif — teşhis ve panel için. Sır DÖNDÜRMEZ. */
export function durum(env = ortam()) {
  const ad = (env.LLM_SAGLAYICI || "openai").toLowerCase();
  const s = SAGLAYICILAR[ad];
  return {
    saglayici: ad,
    gecerli: !!s,
    anahtarVar: s ? !!ilkDolu(s.anahtarEnv, env) : false,
    model: ilkDolu(MODEL_ENV_SIRASI[ad] || [], env) || s?.varsayilanModel || null,
    embeddingAnahtariVar: !!env.OPENAI_API_KEY,
  };
}

export const _test = { mesajlariNormalize, saglayiciSec, paketle, MODEL_ENV_SIRASI };
