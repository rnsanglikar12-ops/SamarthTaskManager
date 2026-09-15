export interface Env {
  SPREADSHEET_ID: string;
  ALLOWED_ORIGINS: string;
  PHOTO_FOLDER_NAME: string;
  GOOGLE_SERVICE_ACCOUNT_JSON: string;
}

export interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}
