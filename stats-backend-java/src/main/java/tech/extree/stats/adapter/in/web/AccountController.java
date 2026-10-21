package tech.extree.stats.adapter.in.web;

import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.application.port.in.GetAccountUseCase;
import tech.extree.stats.adapter.in.web.dto.AccountResponse;
import tech.extree.stats.domain.User;

/** Соответствует GET /api/account/me в server.js (Node), включая поле isAdmin (PR #315). */
@RestController
public class AccountController {

    private static final String SESSION_COOKIE = "extree_stats_session";

    private final GetAccountUseCase getAccountUseCase;

    public AccountController(GetAccountUseCase getAccountUseCase) {
        this.getAccountUseCase = getAccountUseCase;
    }

    @GetMapping("/api/account/me")
    public AccountResponse getAccount(@CookieValue(name = SESSION_COOKIE, required = false) String cookie) {
        return getAccountUseCase
                .getAccount(cookie)
                .map(this::toResponse)
                .orElse(AccountResponse.empty());
    }

    private AccountResponse toResponse(User user) {
        return new AccountResponse(new AccountResponse.AccountUser(
                user.email(),
                user.emailVerified(),
                user.riotLinked(),
                user.name(),
                user.nickname(),
                getAccountUseCase.isAdmin(user)));
    }
}
