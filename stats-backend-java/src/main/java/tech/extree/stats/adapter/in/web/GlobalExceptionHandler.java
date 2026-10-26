package tech.extree.stats.adapter.in.web;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import tech.extree.stats.adapter.in.web.dto.ErrorResponse;

/**
 * Без этого превышение spring.servlet.multipart.max-file-size (см.
 * application.yml) долетало до клиента как дефолтная страница ошибки
 * Spring/Tomcat, а не {"error": "..."} — statsAuth.ts ожидает JSON и на
 * невалидном теле падал в "internal_error" без понятного сообщения.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<ErrorResponse> handleMaxUploadSize(MaxUploadSizeExceededException e) {
        return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(new ErrorResponse("file_too_large"));
    }
}
