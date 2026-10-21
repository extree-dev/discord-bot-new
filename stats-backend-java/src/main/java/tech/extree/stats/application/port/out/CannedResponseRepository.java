package tech.extree.stats.application.port.out;

import java.util.List;
import tech.extree.stats.domain.CannedResponse;

/** Соответствует cannedResponses.js (Node) — stats_canned_responses. */
public interface CannedResponseRepository {
    List<CannedResponse> list();

    /** Возвращает сгенерированный id. */
    String create(String title, String body);

    void delete(String id);
}
