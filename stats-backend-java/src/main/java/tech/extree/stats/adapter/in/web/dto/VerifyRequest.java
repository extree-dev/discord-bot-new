package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/verify. */
public record VerifyRequest(String email, String code) {}
