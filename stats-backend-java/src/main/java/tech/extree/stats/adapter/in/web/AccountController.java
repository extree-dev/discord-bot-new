package tech.extree.stats.adapter.in.web;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tech.extree.stats.adapter.in.web.dto.AccountResponse;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.application.port.in.GetAccountUseCase;
import tech.extree.stats.application.service.AvatarService;
import tech.extree.stats.domain.User;

@RestController
public class AccountController {

    private static final String SESSION_COOKIE = "extree_stats_session";

    private final GetAccountUseCase getAccountUseCase;
    private final AvatarService avatarService;

    public AccountController(GetAccountUseCase getAccountUseCase, AvatarService avatarService) {
        this.getAccountUseCase = getAccountUseCase;
        this.avatarService = avatarService;
    }

    @GetMapping("/api/account/me")
    public ResponseEntity<?> getAccount(@CookieValue(name = SESSION_COOKIE, required = false) String cookie) {
        if (cookie == null) {
            return ResponseEntity.ok(AccountResponse.empty());
        }

        var userOpt = getAccountUseCase.getAccount(cookie);
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(AccountResponse.banned());
        }

        return ResponseEntity.ok(toResponse(userOpt.get()));
    }

    @PostMapping("/api/account/avatar")
    public ResponseEntity<?> uploadAvatar(
            @CookieValue(name = SESSION_COOKIE, required = false) String cookie,
            @RequestParam("file") MultipartFile file) {
        return avatarService.uploadAvatar(cookie, file)
                .<ResponseEntity<?>>map(url -> ResponseEntity.ok(Map.of("avatarUrl", url)))
                .orElseGet(() -> ResponseEntity.badRequest().body(new ErrorResponse("invalid_file")));
    }

    @GetMapping("/api/account/avatar/{filename}")
    public ResponseEntity<Resource> serveFile(@PathVariable String filename) {
        Path baseDir = Paths.get("uploads/avatars").toAbsolutePath().normalize();
        Path file = baseDir.resolve(filename).normalize();
        if (!file.startsWith(baseDir)) {
            return ResponseEntity.notFound().build();
        }
        Resource resource = new FileSystemResource(file);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_TYPE, "image/" + filename.substring(filename.lastIndexOf(".") + 1))
                .body(resource);
    }

    private AccountResponse toResponse(User user) {
        return new AccountResponse(new AccountResponse.AccountUser(
                user.email(),
                user.emailVerified(),
                user.riotLinked(),
                user.name(),
                user.nickname(),
                getAccountUseCase.isAdmin(user),
                user.avatarUrl(),
                user.isVerified()
        ));
    }
}
