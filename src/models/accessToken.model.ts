export class AccessTokenModel {
  public clientId!: string;

  public clientSecret!: string;

  public projectKey!: string;

  public authUrl!: string;
}

export class Wso2AccessTokenModel {
  public authUrl!: string;

  public username!: string;

  public password!: string;

  public grantType!: string;

  public cookie!: string;

  public scope?: string;
}
