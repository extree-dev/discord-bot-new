export interface AuthMethodsResponse {
    telegram: { botUsername: string } | null;
    google: { enabled: true } | null;
    github: { enabled: true } | null;
}
