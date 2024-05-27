import { Log, AsyncStorage, INavigator, IWindow, NavigateParams, NavigateResponse, UserManager, WebStorageStateStore, UserManagerSettings, User } from "oidc-client-ts"
import browser from "webextension-polyfill"

Log.setLogger(console)
Log.setLevel(Log.WARN)

export class SessionStorage implements AsyncStorage {
  get length(): Promise<number> {
    return browser.storage.session.get().then((data) => Object.keys(data).length);
  }

  clear(): Promise<void> {
    return browser.storage.session.clear()
  }

  getItem(key: string): Promise<string | null> {
    return browser.storage.session.get(key).then((data) => data[key] || null)
  }

  key(index: number): Promise<string | null> {
    return browser.storage.session.get().then((data) => Object.keys(data)[index] || null);
  }

  removeItem(key: string): Promise<void> {
    return browser.storage.session.remove(key);
  }

  setItem(key: string, value: string): Promise<void> {
    return browser.storage.session.set({ [key]: value });
  }
}

class PopupNavigator implements INavigator {

  async prepare(_: unknown): Promise<IWindow> {
    return new PopupHandler();
  }

  async callback(url: string, _?: unknown) {
  }

}

class PopupHandler implements IWindow {

  async navigate(params: NavigateParams): Promise<NavigateResponse> {
    let url = await browser.identity.launchWebAuthFlow({ interactive: true, url: params.url })
    return { url }
  }

  close(): void {
  }

}

export interface AuthConfig {
  url: string
  clientId: string
  scope: string 
}

export class AuthService {

  userManager: UserManager

  constructor(config: AuthConfig | UserManager) {
    this.userManager = new UserManager(AuthService.buildSettings(config), undefined, new PopupNavigator(), undefined)
  }

  private static buildSettings(conf: AuthConfig | UserManager): UserManagerSettings {
    let authority, clientId, metadata, scope
    let settings = (conf as UserManager).settings
    if (settings) {
      authority = settings.authority
      clientId = settings.client_id
      scope = settings.scope
      // @ts-ignore: this is the simple way to restore metadata from the json object, by accessing private and protected fields
      metadata = (conf as UserManager)._client.metadataService._metadata
    } else {
      let params = conf as AuthConfig
      authority = params.url
      clientId = params.clientId
      scope = params.scope
    }
    let redirectUri = browser.identity.getRedirectURL()
    return {
      authority: authority,
      client_id: clientId,
      popup_redirect_uri: redirectUri,
      silent_redirect_uri: redirectUri,
      scope: scope,
      userStore: new WebStorageStateStore({ store: new SessionStorage() }),
      /* 
      Since we create a new instance of tabSession, which creates a new instance of this object for every user message, 
      we need to disable automaticSilentRenew to avoid starting a new timer for every user message.
      Tab sessions are re created for every user message because background script can't keep state since it may inactivate 
      at any time and needs to get and store everything in local storage. 
      Local storage does not allow to store objects, just json objects). 
      An alternative could be to refactor logic and keep state in index.vue, but that requires significant refactor and 
      we have faced some inconsistencies (for example while handling sidebar visibility) while handling state in index.vue which we need to research further.
      */
      automaticSilentRenew: false,
      metadata: metadata
    } as UserManagerSettings
  }

  public static fromJsonObject(obj: any): AuthService | undefined {
    return obj ? new AuthService(obj.userManager) : undefined
  }

  public async getUser(): Promise<User | null> {
    let ret = await this.userManager.getUser()
    /* 
    Refresh token if it expires in less than 60 seconds.
    We use 60 seconds as a threshold in case there are differences 
    between browser and server clocks and also to consider potential 
    delays between this check and server token experiation check.
    */
    if (ret && (ret.expires_in! < 60)) {
      return await this.userManager.signinSilent()
    }
    return ret
  }

  public async login(): Promise<void> {
    await this.userManager.signinPopup()
  }

}