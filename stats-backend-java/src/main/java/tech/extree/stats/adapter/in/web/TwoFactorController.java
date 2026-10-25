package tech.extree.stats.adapter.in.web;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.application.port.out.PasswordHasher;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.application.service.TotpService;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

/**
 * /api/account/2fa/* — настройка TOTP 2FA для залогиненного пользователя.
 * Соответствует вызовам из statsAuth.ts: setup2fa/enable2fa/disable2fa/
 * regenerateRecoveryCodes.
 */
@RestController
public class TwoFactorController {

    private final SessionCodec sessionCodec;
    private final UserRepository userRepository;
    private final TotpService totpService;
    private final PasswordHasher passwordHasher;

    public TwoFactorController(
            SessionCodec sessionCodec,
            UserRepository userRepository,
            TotpService totpService,
            PasswordHasher passwordHasher) {
        this.sessionCodec = sessionCodec;
        this.userRepository = userRepository;
        this.totpService = totpService;
        this.passwordHasher = passwordHasher;
    }

    private Optional<User> currentUser(String cookie) {
        if (cookie == null) return Optional.empty();
        Optional<Session> session = sessionCodec.decrypt(cookie).filter(s -> s.userId() != null);
        if (session.isEmpty()) return Optional.empty();
        return userRepository.findById(session.get().userId());
    }

    private static ResponseEntity<ErrorResponse> status(HttpStatus s, String e) {
        return ResponseEntity.status(s).body(new ErrorResponse(e));
    }

    private static ResponseEntity<ErrorResponse> badRequest(String e) {
        return status(HttpStatus.BAD_REQUEST, e);
    }

    @PostMapping("/api/account/2fa/setup")
    public ResponseEntity<?> setup(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestBody Map<String, String> body) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        if (user.get().isBanned()) return status(HttpStatus.FORBIDDEN, "banned");
        String password = body == null ? null : body.get("password");
        if (password == null || password.isBlank()) return badRequest("invalid_request");
        if (!passwordHasher.verify(password, user.get().passwordHash())) {
            return status(HttpStatus.UNAUTHORIZED, "wrong_password");
        }
        if (totpService.isEnabled(user.get().id())) {
            return badRequest("totp_required"); // уже включена — сюда не ходим
        }
        TotpService.SetupResult result = totpService.setup(user.get().id(), user.get().email());
        return ResponseEntity.ok(Map.of(
                "secret", result.secret(),
                "otpauthUrl", result.otpauthUrl(),
                "recoveryCodes", result.recoveryCodes()));
    }

    @PostMapping("/api/account/2fa/enable")
    public ResponseEntity<?> enable(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestBody Map<String, String> body) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        String password = body == null ? null : body.get("password");
        String code = body == null ? null : body.get("code");
        if (password == null || password.isBlank() || code == null || code.isBlank()) {
            return badRequest("invalid_request");
        }
        if (!passwordHasher.verify(password, user.get().passwordHash())) {
            return status(HttpStatus.UNAUTHORIZED, "wrong_password");
        }
        if (!totpService.enable(user.get().id(), code.trim())) {
            return status(HttpStatus.UNAUTHORIZED, "totp_invalid");
        }
        return ResponseEntity.ok(OkResponse.OK);
    }

    @PostMapping("/api/account/2fa/disable")
    public ResponseEntity<?> disable(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestBody Map<String, String> body) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        String password = body == null ? null : body.get("password");
        if (password == null || password.isBlank()) return badRequest("invalid_request");
        if (!passwordHasher.verify(password, user.get().passwordHash())) {
            return status(HttpStatus.UNAUTHORIZED, "wrong_password");
        }
        totpService.disable(user.get().id());
        return ResponseEntity.ok(OkResponse.OK);
    }

    @PostMapping("/api/account/2fa/recovery-codes")
    public ResponseEntity<?> regenerateRecoveryCodes(
            @CookieValue(name = SessionCookies.SESSION_COOKIE, required = false) String cookie,
            @RequestBody Map<String, String> body) {
        Optional<User> user = currentUser(cookie);
        if (user.isEmpty()) return status(HttpStatus.UNAUTHORIZED, "unauthorized");
        String password = body == null ? null : body.get("password");
        if (password == null || password.isBlank()) return badRequest("invalid_request");
        if (!passwordHasher.verify(password, user.get().passwordHash())) {
            return status(HttpStatus.UNAUTHORIZED, "wrong_password");
        }
        if (!totpService.isEnabled(user.get().id())) {
            return badRequest("totp_required"); // нечего перевыпускать
        }
        List<String> codes = totpService.regenerateRecoveryCodes(user.get().id());
        return ResponseEntity.ok(Map.of("recoveryCodes", codes));
    }
}
