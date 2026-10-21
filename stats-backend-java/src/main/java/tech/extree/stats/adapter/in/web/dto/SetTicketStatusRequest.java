package tech.extree.stats.adapter.in.web.dto;

/** Тело POST /api/admin/tickets/:number/status. */
public record SetTicketStatusRequest(String status) {}
