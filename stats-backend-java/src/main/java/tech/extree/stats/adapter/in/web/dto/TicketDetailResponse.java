package tech.extree.stats.adapter.in.web.dto;

import java.util.List;
import tech.extree.stats.application.port.in.AdminTicketUseCase.AdminTicketDetail;
import tech.extree.stats.application.port.in.SupportTicketUseCase.ReplyView;

/** {"ticket": {...}, "replies": [...]} — ответ GET /api/admin/tickets/:number. */
public record TicketDetailResponse(AdminTicketDetail ticket, List<ReplyView> replies) {}
