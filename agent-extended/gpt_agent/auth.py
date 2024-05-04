import datetime
import os
import traceback
from typing import Optional, Annotated, Any

import requests
from fastapi import Depends, HTTPException, status
from fastapi.security import OpenIdConnect
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from starlette.requests import Request


def _build_auth_exception() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Bearer"})


class BearerOpenIdConnect(OpenIdConnect):

    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if not authorization or scheme.lower() != "bearer":
            raise _build_auth_exception()
        return param


class OpenIdConfig:

    def __init__(self, url: str):
        self.url = url
        self._last_update = None
        self._keys = None

    def get_updated_keys(self, period: datetime.timedelta) -> Any:
        if self._last_update is None or datetime.datetime.utcnow() - self._last_update > period:
            self._update_keys()
        return self._keys

    def _update_keys(self):
        self.keys_last_update = datetime.datetime.utcnow()
        config_resp = requests.get(self.url)
        ret_resp = requests.get(config_resp.json()['jwks_uri'])
        self._keys = ret_resp.json()


openid_url = os.getenv("OPENID_URL")
if openid_url is not None:
    config_url = openid_url + "/.well-known/openid-configuration"
    openid_config = OpenIdConfig(config_url)
    auth_scheme = BearerOpenIdConnect(openIdConnectUrl=config_url)
else:
    openid_config = None
    auth_scheme = lambda: None


def _decode_token(token: str) -> dict:
    openid_keys = openid_config.get_updated_keys(datetime.timedelta(days=1))
    options = {"verify_aud": False}
    try:
        return jwt.decode(token, openid_keys, options=options)
    except JWTError as e:
        new_keys = openid_config.get_updated_keys(datetime.timedelta(minutes=5))
        if new_keys == openid_keys:
            raise e
        return jwt.decode(token, new_keys, options=options)


async def get_current_user(token: Annotated[Optional[str], Depends(auth_scheme)]) -> str:
    if openid_url is None:
        return ""
    try:
        payload = _decode_token(token)
        username = payload.get("email")
        # In Azure Authentication we haven't been able to get email attribute, but it is contained
        # in this attribute
        if username is None:
            username = payload.get("unique_name")
        if username is None:
            raise _build_auth_exception()
        return username
    except JWTError as e:
        traceback.print_exception(e)
        raise _build_auth_exception()
