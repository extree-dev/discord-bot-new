package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /auth/account/confirm-email-change — сессия уже знает, к какому аккаунту это относится. */
public record CodeRequest(String code) {}
