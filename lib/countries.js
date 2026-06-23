// ProcessTürk hedef pazarları + yaygın ihracat ülkeleri (ISO-2 + Türkçe ad + bayrak).
export const COUNTRIES = [
  { code: 'TR', name: 'Türkiye', flag: '🇹🇷' },
  { code: 'DE', name: 'Almanya', flag: '🇩🇪' },
  { code: 'GB', name: 'İngiltere', flag: '🇬🇧' },
  { code: 'FR', name: 'Fransa', flag: '🇫🇷' },
  { code: 'NL', name: 'Hollanda', flag: '🇳🇱' },
  { code: 'BE', name: 'Belçika', flag: '🇧🇪' },
  { code: 'IT', name: 'İtalya', flag: '🇮🇹' },
  { code: 'ES', name: 'İspanya', flag: '🇪🇸' },
  { code: 'PL', name: 'Polonya', flag: '🇵🇱' },
  { code: 'SA', name: 'Suudi Arabistan', flag: '🇸🇦' },
  { code: 'AE', name: 'BAE (Dubai)', flag: '🇦🇪' },
  { code: 'EG', name: 'Mısır', flag: '🇪🇬' },
  { code: 'DZ', name: 'Cezayir', flag: '🇩🇿' },
  { code: 'MA', name: 'Fas', flag: '🇲🇦' },
  { code: 'TN', name: 'Tunus', flag: '🇹🇳' },
  { code: 'LY', name: 'Libya', flag: '🇱🇾' },
  { code: 'IQ', name: 'Irak', flag: '🇮🇶' },
  { code: 'KW', name: 'Kuveyt', flag: '🇰🇼' },
  { code: 'QA', name: 'Katar', flag: '🇶🇦' },
  { code: 'JO', name: 'Ürdün', flag: '🇯🇴' },
  { code: 'NG', name: 'Nijerya', flag: '🇳🇬' },
  { code: 'GH', name: 'Gana', flag: '🇬🇭' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪' },
  { code: 'ET', name: 'Etiyopya', flag: '🇪🇹' },
  { code: 'ZA', name: 'Güney Afrika', flag: '🇿🇦' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳' },
  { code: 'CI', name: 'Fildişi Sahili', flag: '🇨🇮' },
  { code: 'TZ', name: 'Tanzanya', flag: '🇹🇿' },
  { code: 'AZ', name: 'Azerbaycan', flag: '🇦🇿' },
  { code: 'KZ', name: 'Kazakistan', flag: '🇰🇿' },
  { code: 'UZ', name: 'Özbekistan', flag: '🇺🇿' },
  { code: 'RU', name: 'Rusya', flag: '🇷🇺' },
  { code: 'UA', name: 'Ukrayna', flag: '🇺🇦' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladeş', flag: '🇧🇩' },
  { code: 'ID', name: 'Endonezya', flag: '🇮🇩' },
  { code: 'MY', name: 'Malezya', flag: '🇲🇾' },
  { code: 'US', name: 'ABD', flag: '🇺🇸' },
  { code: 'CA', name: 'Kanada', flag: '🇨🇦' },
  { code: 'AU', name: 'Avustralya', flag: '🇦🇺' },
];

export function findCountry(code) {
  return COUNTRIES.find((c) => c.code === code) || { code, name: code, flag: '🌍' };
}

export function codesToDisplay(codes = []) {
  return codes.map((c) => findCountry(c));
}
