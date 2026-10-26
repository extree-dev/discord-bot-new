package tech.extree.stats.adapter.in.web.dto;

public record AccountResponse(AccountUser user, boolean banned) {
    public record AccountUser(
            String email,
            boolean emailVerified,
            boolean riotLinked,
            String name,
            String nickname,
            boolean isAdmin,
            String avatarUrl,
            boolean isVerified,
            boolean isTwoFactorEnabled
    ) {}

    public static AccountResponse empty() {
        return new AccountResponse(null, false);
    }

    public static AccountResponse of(AccountUser user) {
        return new AccountResponse(user, false);
    }
}