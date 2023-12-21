import os
import traceback
from typing import Optional, Annotated, Any
import requests

from fastapi import Depends, HTTPException, status
from fastapi.security import OpenIdConnect
from fastapi.security.utils import get_authorization_scheme_param
from jose import JWTError, jwt
from starlette.requests import Request


def _extract_jwks(config_url: str) -> Any:
    config_resp = requests.get(config_url)
    ret_resp = requests.get(config_resp.json()['jwks_uri'])
    return ret_resp.json()


def _build_auth_exception() -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, headers={"WWW-Authenticate": "Bearer"})


class BearerOpenIdConnect(OpenIdConnect):

    async def __call__(self, request: Request) -> Optional[str]:
        authorization = request.headers.get("Authorization")
        scheme, param = get_authorization_scheme_param(authorization)
        if not authorization or scheme.lower() != "bearer":
            raise _build_auth_exception()
        return param


openid_url = os.getenv("OPENID_URL")
if openid_url is not None:
    config_url = openid_url + "/.well-known/openid-configuration"
    openid_keys = _extract_jwks(config_url)
    auth_scheme = BearerOpenIdConnect(openIdConnectUrl=config_url)
else:
    openid_keys = None
    auth_scheme = lambda: None


async def get_current_user(token: Annotated[Optional[str], Depends(auth_scheme)]) -> str:
    if openid_url is None:
        return ""
    try:
        payload = jwt.decode(token, openid_keys, options={"verify_aud": False})
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
