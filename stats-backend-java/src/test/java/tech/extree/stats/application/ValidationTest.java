package tech.extree.stats.application;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ValidationTest {

    @Test
    void parseRiotIdAcceptsValid() {
        Validation.RiotId id = Validation.parseRiotId("Faker#KR1");
        assertThat(id).isNotNull();
        assertThat(id.gameName()).isEqualTo("Faker");
        assertThat(id.tagLine()).isEqualTo("KR1");
    }

    @Test
    void parseRiotIdAcceptsUnicodeGameName() {
        Validation.RiotId id = Validation.parseRiotId("Игрок#EUW");
        assertThat(id).isNotNull();
        assertThat(id.gameName()).isEqualTo("Игрок");
    }

    @Test
    void parseRiotIdAcceptsGameNameWithSpaces() {
        Validation.RiotId id = Validation.parseRiotId("Some Name#EUW");
        assertThat(id).isNotNull();
        assertThat(id.gameName()).isEqualTo("Some Name");
    }

    @Test
    void parseRiotIdAcceptsHashInGameName() {
        // lastIndexOf — как в Node: часть до последнего #, тег после
        Validation.RiotId id = Validation.parseRiotId("A#B#EUW");
        assertThat(id).isNotNull();
        assertThat(id.gameName()).isEqualTo("A#B");
        assertThat(id.tagLine()).isEqualTo("EUW");
    }

    @Test
    void parseRiotIdTrimsWhitespace() {
        Validation.RiotId id = Validation.parseRiotId("  Faker#KR1  ");
        assertThat(id.gameName()).isEqualTo("Faker");
        assertThat(id.tagLine()).isEqualTo("KR1");
    }

    @Test
    void parseRiotIdRejectsNull() {
        assertThat(Validation.parseRiotId(null)).isNull();
    }

    @Test
    void parseRiotIdRejectsEmpty() {
        assertThat(Validation.parseRiotId("")).isNull();
    }

    @Test
    void parseRiotIdRejectsNoHash() {
        assertThat(Validation.parseRiotId("Faker")).isNull();
    }

    @Test
    void parseRiotIdRejectsHashAtStart() {
        assertThat(Validation.parseRiotId("#KR1")).isNull();
    }

    @Test
    void parseRiotIdRejectsHashAtEnd() {
        assertThat(Validation.parseRiotId("Faker#")).isNull();
    }

    @Test
    void parseRiotIdRejectsTooShortTag() {
        assertThat(Validation.parseRiotId("Faker#EU")).isNull();
    }

    @Test
    void parseRiotIdRejectsTooLongTag() {
        assertThat(Validation.parseRiotId("Faker#EUW12X")).isNull();
    }

    @Test
    void parseRiotIdRejectsSpecialCharsInTag() {
        assertThat(Validation.parseRiotId("Faker#EU-")).isNull();
        assertThat(Validation.parseRiotId("Faker#EU W")).isNull();
    }

    @Test
    void parseRiotIdRejectsTooLongGameName() {
        assertThat(Validation.parseRiotId("a".repeat(17) + "#EUW")).isNull();
    }
}