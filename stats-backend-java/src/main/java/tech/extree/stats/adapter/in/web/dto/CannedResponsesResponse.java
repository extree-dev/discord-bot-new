package tech.extree.stats.adapter.in.web.dto;

import java.util.List;
import tech.extree.stats.application.port.in.AdminTicketUseCase.CannedResponseView;

/** {"responses": [...]} — ответ GET /api/admin/canned-responses. */
public record CannedResponsesResponse(List<CannedResponseView> responses) {}
