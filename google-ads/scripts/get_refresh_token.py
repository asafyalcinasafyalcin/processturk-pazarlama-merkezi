#!/usr/bin/env python3
"""
Google Ads API — refresh token üretici (TEK SEFERLİK).
.env.local'den CLIENT_ID/SECRET okur → tarayıcıda Google onayı alır →
REFRESH_TOKEN'ı doğrudan .env.local'e yazar (sana pano/kopyala gerekmez).

ÖN KOŞUL (Cloud Console → Kimlik bilgileri → OAuth istemcini aç):
  "Yetkili yönlendirme URI'leri"ne şunu ekle ve KAYDET:
      http://localhost:8080/          ← sondaki eğik çizgi dahil, birebir
  (1-2 dk yayılması için bekle.)

KURULUM:  pip3 install google-auth-oauthlib
ÇALIŞTIR: python3 get_refresh_token.py
"""
import os, re, sys

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env.local")
ENV_PATH = os.path.abspath(ENV_PATH)


def read_env():
    vals = {}
    with open(ENV_PATH) as f:
        for line in f:
            s = line.strip()
            if s and not s.startswith("#") and "=" in s:
                k, v = s.split("=", 1)
                vals[k.strip()] = v.strip()
    return vals


def write_env_value(key, value):
    with open(ENV_PATH) as f:
        content = f.read()
    pat = rf"^{re.escape(key)}=.*$"
    if re.search(pat, content, flags=re.M):
        content = re.sub(pat, f"{key}={value}", content, flags=re.M)
    else:
        content += f"\n{key}={value}\n"
    with open(ENV_PATH, "w") as f:
        f.write(content)


def main():
    try:
        from google_auth_oauthlib.flow import InstalledAppFlow
    except ImportError:
        sys.exit("Eksik paket. Önce çalıştır:  pip3 install google-auth-oauthlib")

    env = read_env()
    cid = env.get("GOOGLE_ADS_CLIENT_ID")
    secret = env.get("GOOGLE_ADS_CLIENT_SECRET")
    if not cid or not secret:
        sys.exit("CLIENT_ID / CLIENT_SECRET .env.local'de bulunamadı.")

    client_config = {
        "web": {
            "client_id": cid,
            "client_secret": secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8080/"],
        }
    }
    flow = InstalledAppFlow.from_client_config(
        client_config, scopes=["https://www.googleapis.com/auth/adwords"]
    )
    creds = flow.run_local_server(
        port=8080,
        prompt="consent",
        access_type="offline",
        authorization_prompt_message=(
            "Tarayıcı açılıyor → Google hesabınla (asafyalcinistanbullu@gmail.com) onayla.\n"
            "'Google bu uygulamayı doğrulamadı' çıkarsa: Gelişmiş → 'ProcessTurk Ads'e git' → İzin ver."
        ),
        success_message="Bitti! Bu sekmeyi kapatabilirsin.",
    )
    if not creds.refresh_token:
        sys.exit("Refresh token gelmedi. Tekrar dene (prompt=consent zorunlu).")

    write_env_value("GOOGLE_ADS_REFRESH_TOKEN", creds.refresh_token)
    print("\n✅ Refresh token .env.local'e yazıldı. Tam API bağlantısı hazır.")
    print("Claude'a 'refresh token tamam' de.")


if __name__ == "__main__":
    main()
