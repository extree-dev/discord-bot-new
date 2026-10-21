package tech.extree.stats.adapter.in.web.dto;

import java.util.List;
import tech.extree.stats.application.port.in.AccountSettingsUseCase.LoginEventView;

/** {"events": [...]}  — ответ GET /api/account/login-history. LoginEventView уже форма JSON-ответа 1:1. */
public record LoginHistoryResponse(List<LoginEventView> events) {}
