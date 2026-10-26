package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/register — поля не валидируются здесь, этим занимается RegistrationService. */
public record RegisterRequest(String email, String password, String name, String nickname) {}
