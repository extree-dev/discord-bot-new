export interface SiteLink {
    label: string;
    url: string;
}

export interface SiteContent {
    name: string;
    role: string;
    bio: string;
    links: SiteLink[];
}

export interface SiteContentResponse extends SiteContent {
    maxLinks: number;
}

export interface SiteAdminStatus {
    isAdmin: boolean;
}
