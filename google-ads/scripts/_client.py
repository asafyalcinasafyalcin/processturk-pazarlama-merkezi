"""
Ortak Google Ads API istemcisi — .env.local'den kimlik bilgilerini okuyup GoogleAdsClient kurar.
Diğer script'ler:  from _client import build_client, ACCOUNT_ID
"""
import os

_ENV = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".env.local"))


def _read_env():
    vals = {}
    with open(_ENV) as f:
        for line in f:
            s = line.strip()
            if s and not s.startswith("#") and "=" in s:
                k, v = s.split("=", 1)
                vals[k.strip()] = v.strip()
    return vals


_env = _read_env()
ACCOUNT_ID = _env.get("GOOGLE_ADS_CUSTOMER_ID", "").replace("-", "")
LOGIN_ID = _env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "").replace("-", "")


def build_client():
    from google.ads.googleads.client import GoogleAdsClient

    cfg = {
        "developer_token": _env["GOOGLE_ADS_DEVELOPER_TOKEN"],
        "client_id": _env["GOOGLE_ADS_CLIENT_ID"],
        "client_secret": _env["GOOGLE_ADS_CLIENT_SECRET"],
        "refresh_token": _env["GOOGLE_ADS_REFRESH_TOKEN"],
        "login_customer_id": LOGIN_ID,
        "use_proto_plus": True,
    }
    return GoogleAdsClient.load_from_dict(cfg)
