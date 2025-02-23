export interface UserInfo {
  Id: string;
  Name: string;
  FamilyName: string;
  Email: string;
  Password: string;
  confirmationToken: string;
  tokenExpiration: number;
  isConfirmed: boolean;
  uploadCount?: number;
  lastUploadDate?: string;
  notification_enabled?: number;
}
