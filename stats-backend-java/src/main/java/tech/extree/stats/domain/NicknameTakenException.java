package tech.extree.stats.domain;

/** Соответствует err.constraint === 'stats_users_nickname_key' в server.js. */
public class NicknameTakenException extends RuntimeException {
    public NicknameTakenException(String nickname) {
        super("Nickname already taken: " + nickname);
    }
}
