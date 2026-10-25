package tech.extree.stats.adapter.in.web;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import tech.extree.stats.adapter.in.web.dto.AdminUserResponse;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;
import tech.extree.stats.adapter.in.web.dto.OkResponse;
import tech.extree.stats.application.port.out.AdminAuditRepository;
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
    private final AdminAuditRepository auditRepository;

    public AdminUserController(UserRepository userRepository, SessionCodec sessionCodec, AdminAuditRepository auditRepository) {
        this.userRepository = userRepository;
        this.sessionCodec = sessionCodec;
        this.auditRepository = auditRepository;
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
            @RequestParam boolean isVerified, HttpServletRequest httpRequest) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));
        userRepository.setVerified(userId, isVerified);
        String adminId = currentAdminId(cookie);
        if (adminId != null) {
            auditRepository.record(adminId, "user.verify", "user", userId,
                    "{\"isVerified\":" + isVerified + "}", ClientIp.from(httpRequest));
        }
        return ResponseEntity.ok(OkResponse.OK);
    }

    @PostMapping("/api/admin/users/{userId}/ban")
    public ResponseEntity<?> banUser(
            @PathVariable String userId,
            @CookieValue(name = "extree_stats_session", required = false) String cookie,
            @RequestParam boolean isBanned, HttpServletRequest httpRequest) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));
        userRepository.setBanned(userId, isBanned);
        String adminId = currentAdminId(cookie);
        if (adminId != null) {
            auditRepository.record(adminId, "user.ban", "user", userId,
                    "{\"isBanned\":" + isBanned + "}", ClientIp.from(httpRequest));
        }
        return ResponseEntity.ok(OkResponse.OK);
    }

    // НОВЫЙ ЭНДПОИНТ: Назначить/снять админа
    @PostMapping("/api/admin/users/{userId}/make-admin")
    public ResponseEntity<?> makeAdmin(
            @PathVariable String userId,
            @CookieValue(name = "extree_stats_session", required = false) String cookie,
            @RequestParam boolean isAdmin, HttpServletRequest httpRequest) {
        if (!isAdmin(cookie)) return ResponseEntity.status(403).body(new OkResponse(false));

        // Снятие прав с ПОСЛЕДНЕГО оставшегося админа (в т.ч. с самого себя)
        // оставило бы аккаунт без единого админа — восстановить доступ
        // можно было бы только руками в БД. Считаем по факту (findAllUsers),
        // не по кешу: отдельного countAdmins() в порту нет, а это редкое
        // действие, не узкое место производительности.
        if (!isAdmin) {
            boolean targetIsCurrentlyAdmin = userRepository.findById(userId).map(User::isAdmin).orElse(false);
            if (targetIsCurrentlyAdmin) {
                long adminCount = userRepository.findAllUsers().stream().filter(User::isAdmin).count();
                if (adminCount <= 1) {
                    return ResponseEntity.status(409).body(new ErrorResponse("last_admin"));
                }
            }
        }

        userRepository.setAdmin(userId, isAdmin);
        String adminId = currentAdminId(cookie);
        if (adminId != null) {
            auditRepository.record(adminId, "user.make_admin", "user", userId,
                    "{\"isAdmin\":" + isAdmin + "}", ClientIp.from(httpRequest));
        }
        return ResponseEntity.ok(OkResponse.OK);
    }

    private String currentAdminId(String cookie) {
        if (cookie == null) return null;
        return sessionCodec.decrypt(cookie)
                .filter(s -> s.userId() != null)
                .map(s -> s.userId())
                .orElse(null);
    }
}