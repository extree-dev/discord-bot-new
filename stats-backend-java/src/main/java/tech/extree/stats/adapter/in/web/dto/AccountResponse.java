package tech.extree.stats.adapter.in.web.dto;

/** Форма ответа GET /api/account/me — зеркалит server.js один в один, включая isAdmin (см. PR #315). */
public record AccountResponse(AccountUser user) {
    public record AccountUser(
            String email,
            boolean emailVerified,
            boolean riotLinked,
            String name,
            String nickname,
            boolean isAdmin) {}

    public static AccountResponse empty() {
        return new AccountResponse(null);
    }
}
