package tech.extree.stats.adapter.in.web;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.extree.stats.adapter.in.web.dto.AdminUserResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.application.port.out.SessionCodec;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.Session;
import tech.extree.stats.domain.User;

import java.util.List;
import java.util.Optional;

@RestController
public class AdminUserController {

    private final UserRepository userRepository;
    private final SessionCodec sessionCodec;

    public AdminUserController(UserRepository userRepository, SessionCodec sessionCodec) {
        this.userRepository = userRepository;
        this.sessionCodec = sessionCodec;
    }

    private boolean isAdmin(String cookie) {
        if (cookie == null) return false;
        Optional<Session> session = sessionCodec.decrypt(cookie);
        if (session.isEmpty() || session.get().userId() == null) return false;
        return userRepository.findById(session.get().userId())
                .map(User::isAdmin)
                .orElse(false);
    }

    @GetMapping("/api/admin/users")
    public ResponseEntity<?> listUsers(@CookieValue(name = "extree_stats_session", required = false) String cookie) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));

        List<AdminUserResponse.AdminUser> users = userRepository.findAllUsers().stream()
                .map(u -> new AdminUserResponse.AdminUser(
                        u.id(), u.email(), u.name(), u.nickname(), u.avatarUrl(),
                        u.isVerified(), u.isBanned(), u.isAdmin()))
                .toList();

        return ResponseEntity.ok(new AdminUserResponse(users));
    }

    @PostMapping("/api/admin/users/{userId}/verify")
    public ResponseEntity<?> verifyUser(
            @PathVariable String userId,
            @CookieValue(name = "extree_stats_session", required = false) String cookie,
            @RequestParam boolean isVerified) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));
        userRepository.setVerified(userId, isVerified);
        return ResponseEntity.ok(OkResponse.OK);
    }

    @PostMapping("/api/admin/users/{userId}/ban")
    public ResponseEntity<?> banUser(
            @PathVariable String userId,
            @CookieValue(name = "extree_stats_session", required = false) String cookie,
            @RequestParam boolean isBanned) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));
        userRepository.setBanned(userId, isBanned);
        return ResponseEntity.ok(OkResponse.OK);
    }

    // НОВЫЙ ЭНДПОИНТ: Назначить/снять админа
    @PostMapping("/api/admin/users/{userId}/make-admin")
    public ResponseEntity<?> makeAdmin(
            @PathVariable String userId,
            @CookieValue(name = "extree_stats_session", required = false) String cookie,
            @RequestParam boolean isAdmin) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));
        userRepository.setAdmin(userId, isAdmin);
        return ResponseEntity.ok(OkResponse.OK);
    }
}