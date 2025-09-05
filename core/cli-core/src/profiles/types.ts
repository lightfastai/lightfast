export interface Profile {
  name: string;
  endpoint?: string;
  userId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Config {
  defaultProfile: string;
  profiles: Record<string, Profile>;
}

export interface AuthData {
  tokens: Record<string, string>; // profileName -> token
}