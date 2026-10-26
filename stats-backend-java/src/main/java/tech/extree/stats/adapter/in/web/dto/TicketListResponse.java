package tech.extree.stats.adapter.in.web.dto;

import java.util.List;
import tech.extree.stats.application.port.in.AdminTicketUseCase.AdminTicketSummary;

/** {"tickets": [...]} — ответ GET /api/admin/tickets. AdminTicketSummary уже форма JSON 1:1. */
public record TicketListResponse(List<AdminTicketSummary> tickets) {}
