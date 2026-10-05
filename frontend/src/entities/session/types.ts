export interface SessionUser {
    id: string;
    username: string;
    avatarUrl: string;
}

export interface SessionResponse {
    user: SessionUser | null;
}
