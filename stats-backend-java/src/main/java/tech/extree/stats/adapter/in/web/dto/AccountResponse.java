package tech.extree.stats.adapter.in.web.dto;

public record AccountResponse(AccountUser user) {
    public record AccountUser(
            String email,
            boolean emailVerified,
            boolean riotLinked,
            String name,
            String nickname,
            boolean isAdmin,
            String avatarUrl,
            boolean isVerified // <-- Новое поле
    ) {}

    public static AccountResponse empty() {
        return new AccountResponse(null);
    }
}