package tech.extree.stats.domain;

import java.time.Instant;

/** Зеркало строки stats_support_ticket_replies. author — "user" | "admin". */
public record TicketReply(String id, String author, String message, Instant createdAt) {}
