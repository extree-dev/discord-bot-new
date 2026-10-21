package tech.extree.stats.adapter.in.web.dto;

/** {"ok": true, "ticketNumber": N} — ответ server.js на успешную подачу заявки. */
public record CreateTicketResponse(boolean ok, long ticketNumber) {}
