package tech.extree.stats.adapter.in.web;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import tech.extree.stats.application.port.out.AdminAuditRepository;
import tech.extree.stats.application.port.out.SessionRepository;
import tech.extree.stats.application.port.out.UserRepository;
import tech.extree.stats.domain.LoginSession;
import tech.extree.stats.domain.User;

class AdminUserControllerTest {

    private UserRepository userRepository;
    private SessionRepository sessionRepository;
    private AdminAuditRepository auditRepository;
    private AdminUserController controller;
    private HttpServletRequest httpRequest;

    private final User admin =
            new User("admin-id", "admin@test.com", "hash", Instant.now(), null, "Admin", "admin", null, true, false, true);
    private final User otherAdmin =
            new User("other-admin-id", "other@test.com", "hash", Instant.now(), null, "Other", "other", null, true, false, true);
    private final User plainUser =
            new User("user-id", "user@test.com", "hash", Instant.now(), null, "User", "user", null, true, false, false);

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        sessionRepository = mock(SessionRepository.class);
        auditRepository = mock(AdminAuditRepository.class);
        httpRequest = mock(HttpServletRequest.class);
        controller = new AdminUserController(userRepository, sessionRepository, auditRepository);

        when(sessionRepository.validate("admin-cookie")).thenReturn(Optional.of(new LoginSession("session-id", null, "admin-id", 0L)));
        when(userRepository.findById("admin-id")).thenReturn(Optional.of(admin));
    }

    @Test
    void refusesToRemoveAdminFromTheLastRemainingAdmin() {
        when(userRepository.findById("admin-id")).thenReturn(Optional.of(admin));
        when(userRepository.findAllUsers()).thenReturn(List.of(admin, plainUser));

        ResponseEntity<?> response = controller.makeAdmin("admin-id", "admin-cookie", false, httpRequest);

        assertEquals(409, response.getStatusCode().value());
        verify(userRepository, never()).setAdmin("admin-id", false);
    }

    @Test
    void allowsRemovingAdminWhenAnotherAdminRemains() {
        when(userRepository.findById("other-admin-id")).thenReturn(Optional.of(otherAdmin));
        when(userRepository.findAllUsers()).thenReturn(List.of(admin, otherAdmin));

        ResponseEntity<?> response = controller.makeAdmin("other-admin-id", "admin-cookie", false, httpRequest);

        assertEquals(200, response.getStatusCode().value());
        verify(userRepository).setAdmin("other-admin-id", false);
    }

    @Test
    void grantingAdminNeverNeedsTheLastAdminCheck() {
        when(userRepository.findAllUsers()).thenReturn(List.of(admin, plainUser));

        ResponseEntity<?> response = controller.makeAdmin("user-id", "admin-cookie", true, httpRequest);

        assertEquals(200, response.getStatusCode().value());
        verify(userRepository).setAdmin("user-id", true);
    }
}
