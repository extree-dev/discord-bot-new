package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /api/support/tickets. email игнорируется, если есть сессия (см. SupportTicketService). */
public record CreateTicketRequest(String email, String subject, String message, String category) {}
