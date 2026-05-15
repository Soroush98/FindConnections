export interface UserInfo {
  Id: string;
  Name: string;
  FamilyName: string;
  Email: string;
  Password: string;
  confirmationToken?: string;
  tokenExpiration?: number;
  isConfirmed: boolean;
  notification_enabled?: number;
  resetToken?: string;
  resetTokenExpiration?: number;
}
