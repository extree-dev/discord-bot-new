package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /api/admin/canned-responses. */
public record CreateCannedResponseRequest(String title, String body) {}
