package tech.extree.stats.adapter.in.web;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** Соответствует GET /auth/logout в server.js: чистит cookie, редиректит на "/". */
@RestController
public class LogoutController {

    @GetMapping("/auth/logout")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.SET_COOKIE, SessionCookies.clear().toString())
                .header(HttpHeaders.LOCATION, "/")
                .build();
    }
}
