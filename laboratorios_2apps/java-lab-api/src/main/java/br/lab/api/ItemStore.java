package br.lab.api;

import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Persistência na tabela items do PostgreSQL (../postgres-lab), a mesma da flask-lab-api.
 * - O id vem do banco (identity): nunca se repete, nem quando o maior é excluído.
 * - Cada método é uma única instrução SQL com autocommit, então não precisa de trava.
 */
@Component
public class ItemStore {

    private static final String COLUNAS = "id, nome, quantidade";

    private static final RowMapper<Item> ITEM = (rs, linha) ->
            new Item(rs.getLong("id"), rs.getString("nome"), rs.getLong("quantidade"));

    private final JdbcClient jdbc;

    public ItemStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public long contar() {
        return jdbc.sql("SELECT count(*) FROM items").query(Long.class).single();
    }

    public List<Item> listar() {
        return jdbc.sql("SELECT " + COLUNAS + " FROM items ORDER BY id").query(ITEM).list();
    }

    /** Trecho do nome, sem diferenciar maiúsculas. strpos (e não LIKE): "%" e "_" valem como texto. */
    public List<Item> filtrar(String trecho) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM items WHERE strpos(lower(nome), lower(:trecho)) > 0 ORDER BY id")
                .param("trecho", trecho)
                .query(ITEM).list();
    }

    public Optional<Item> buscar(long id) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM items WHERE id = :id")
                .param("id", id)
                .query(ITEM).optional();
    }

    public Item criar(String nome, long quantidade) {
        return jdbc.sql("INSERT INTO items (nome, quantidade) VALUES (:nome, :quantidade) RETURNING " + COLUNAS)
                .param("nome", nome)
                .param("quantidade", quantidade)
                .query(ITEM).single();
    }

    /** Substitui nome e quantidade. Vazio se o id não existir. */
    public Optional<Item> atualizar(long id, String nome, long quantidade) {
        return jdbc.sql("UPDATE items SET nome = :nome, quantidade = :quantidade WHERE id = :id RETURNING " + COLUNAS)
                .param("id", id)
                .param("nome", nome)
                .param("quantidade", quantidade)
                .query(ITEM).optional();
    }

    /** Remove o item. false se o id não existir. */
    public boolean excluir(long id) {
        return jdbc.sql("DELETE FROM items WHERE id = :id").param("id", id).update() > 0;
    }
}
