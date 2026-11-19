package br.lab.api;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import java.io.IOException;
import java.io.UncheckedIOException;

/**
 * PostgreSQL de verdade para os testes: binário embutido (zonky), sem Docker.
 * Sobe uma vez por JVM, numa porta livre, e é desligado no fim.
 */
final class BancoDeTeste {

    /** Cópia do DDL de ../postgres-lab/initdb/01-init.sh: mude os dois juntos. */
    static final String DDL = """
            CREATE TABLE IF NOT EXISTS items (
                id         bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nome       text   NOT NULL CHECK (btrim(nome) <> ''),
                quantidade bigint NOT NULL DEFAULT 1 CHECK (quantidade >= 0)
            )""";

    private static final EmbeddedPostgres PG;

    static {
        try {
            PG = EmbeddedPostgres.builder().start();
        } catch (IOException e) {
            throw new UncheckedIOException("não consegui subir o PostgreSQL embutido", e);
        }
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                PG.close();
            } catch (IOException ignorado) {
                // JVM já está saindo
            }
        }));
    }

    static String jdbcUrl() {
        return PG.getJdbcUrl("postgres", "postgres");
    }

    private BancoDeTeste() {
    }
}
