package tech.extree.stats.adapter.in.web.dto;

/** Тело POST .../reply (и пользовательский, и админский ответ на тикет). */
public record MessageRequest(String message) {}
