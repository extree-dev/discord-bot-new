package tech.extree.stats.domain;

import java.time.Instant;

/**
 * Зеркало строки stats_support_tickets (см. ../../stats-backend/supportTickets.js).
 * message/userId null там, где адаптер читает облегчённую выборку (список
 * для админки не тянет текст сообщения — та же экономия, что у Node).
 */
public record SupportTicket(
        String id,
        String userId,
        String email,
        String subject,
        String message,
        String category,
        String status,
        String viewToken,
        long ticketNumber,
        Instant createdAt) {}
