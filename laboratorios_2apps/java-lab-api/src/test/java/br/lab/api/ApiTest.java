package br.lab.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;

/** Testes HTTP de ponta a ponta contra um PostgreSQL real (BancoDeTeste). */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class ApiTest {

    @DynamicPropertySource
    static void banco(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", BancoDeTeste::jdbcUrl);
        registry.add("spring.datasource.username", () -> "postgres");
        registry.add("spring.datasource.password", () -> "");
    }

    @LocalServerPort
    int porta;

    @Autowired
    JdbcClient banco;

    final HttpClient http = HttpClient.newHttpClient();
    final ObjectMapper json = new ObjectMapper();

    record Resposta(int status, String contentType, JsonNode corpo) {}

    /** Cada teste começa com os 2 itens iniciais e o próximo id = 3, como no 01-init.sh. */
    @BeforeEach
    void limpar() {
        banco.sql(BancoDeTeste.DDL).update();
        banco.sql("TRUNCATE items RESTART IDENTITY").update();
        banco.sql("INSERT INTO items (nome, quantidade) VALUES ('notebook', 2), ('monitor', 1)").update();
    }

    /** O que está gravado no banco, em ordem de id, no mesmo formato JSON compacto da API. */
    String noBanco() throws Exception {
        String linhas = banco.sql("SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'nome', nome,"
                + " 'quantidade', quantidade) ORDER BY id), '[]')::text FROM items").query(String.class).single();
        return json.readTree(linhas).toString();
    }

    Resposta enviar(HttpRequest.Builder req) throws Exception {
        HttpResponse<String> r = http.send(req.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String ct = r.headers().firstValue("Content-Type").orElse("");
        return new Resposta(r.statusCode(), ct, r.body().isEmpty() ? null : json.readTree(r.body()));
    }

    HttpRequest.Builder req(String caminho) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + porta + caminho));
    }

    Resposta get(String caminho) throws Exception {
        return enviar(req(caminho).GET());
    }

    Resposta post(String corpo) throws Exception {
        return post(corpo, "application/json");
    }

    Resposta post(String corpo, String contentType) throws Exception {
        HttpRequest.Builder b = req("/items").POST(HttpRequest.BodyPublishers.ofString(corpo));
        if (contentType != null) {
            b.header("Content-Type", contentType);
        }
        return enviar(b);
    }

    // ---------- /health ----------

    @Test
    void healthConsultaOBancoEDevolveTotal() throws Exception {
        Resposta r = get("/health");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.corpo().get("status").asText()).isEqualTo("ok");
        assertThat(r.corpo().get("total").asInt()).isEqualTo(2);

        post("{\"nome\":\"x\"}");
        assertThat(get("/health").corpo().get("total").asInt()).isEqualTo(3);
    }
    // health com o banco fora do ar: BancoForaTest

    // ---------- GET /items ----------

    @Test
    void listaEstadoInicial() throws Exception {
        Resposta r = get("/items");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.contentType()).startsWith("application/json");
        assertThat(r.corpo().get("total").asInt()).isEqualTo(2);
        assertThat(r.corpo().get("items").toString()).isEqualTo(
                "[{\"id\":1,\"nome\":\"notebook\",\"quantidade\":2},{\"id\":2,\"nome\":\"monitor\",\"quantidade\":1}]");
    }

    @Test
    void filtroPorNomeSubstringCaseInsensitive() throws Exception {
        Resposta r = get("/items?nome=NiT");
        assertThat(r.corpo().get("total").asInt()).isEqualTo(1);
        assertThat(r.corpo().get("items").get(0).get("nome").asText()).isEqualTo("monitor");

        assertThat(get("/items?nome=xyz").corpo().get("total").asInt()).isZero();
        assertThat(get("/items?nome=").corpo().get("total").asInt()).isEqualTo(2);
    }

    @Test
    void filtroTrataCuringasDoSqlComoTexto() throws Exception {
        post("{\"nome\":\"100% algodão\"}");
        post("{\"nome\":\"cabo_usb\"}");
        assertThat(get("/items?nome=%25").corpo().get("total").asInt()).isEqualTo(1);
        assertThat(get("/items?nome=_").corpo().get("items").get(0).get("nome").asText()).isEqualTo("cabo_usb");
        assertThat(get("/items?nome=ALGOD%C3%83O").corpo().get("total").asInt()).isEqualTo(1); // acento, maiúsculas
        assertThat(get("/items?nome=%00").corpo().get("total").asInt()).isZero();
    }

    // ---------- GET /items/{id} ----------

    @Test
    void buscaPorId() throws Exception {
        Resposta r = get("/items/2");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.corpo().toString()).isEqualTo("{\"id\":2,\"nome\":\"monitor\",\"quantidade\":1}");
    }

    @Test
    void itemInexistente404ComId() throws Exception {
        Resposta r = get("/items/999");
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.corpo().toString()).isEqualTo("{\"erro\":\"item não encontrado\",\"id\":999}");
    }

    @Test
    void idNaoNumericoERotaInexistente() throws Exception {
        for (String caminho : List.of("/items/abc", "/nao-existe", "/items/", "/items/-1")) {
            Resposta r = get(caminho);
            assertThat(r.status()).as(caminho).isEqualTo(404);
            assertThat(r.contentType()).as(caminho).startsWith("application/json");
            assertThat(r.corpo().get("erro").asText()).as(caminho).isEqualTo("rota não encontrada");
        }
    }

    @Test
    void erroEmJsonMesmoPedindoHtml() throws Exception {
        Resposta r = enviar(req("/nao-existe").header("Accept", "text/html").GET());
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.contentType()).startsWith("application/json");
    }

    @Test
    void urlMalformadaRejeitadaPeloTomcatTambemEmJson() throws Exception {
        // HttpClient não deixa enviar "%" cru; usamos socket direto
        try (var s = new java.net.Socket("localhost", porta)) {
            s.getOutputStream().write(
                    "GET /items/% HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n".getBytes());
            String resposta = new String(s.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            assertThat(resposta).startsWith("HTTP/1.1 400");
            assertThat(resposta).containsIgnoringCase("Content-Type: application/json");
            assertThat(resposta).contains("{\"erro\":\"requisição inválida\"}");
            assertThat(resposta).doesNotContain("<html");
        }
    }

    @Test
    void metodoNaoPermitidoEmJson() throws Exception {
        Resposta r = enviar(req("/items").DELETE());
        assertThat(r.status()).isEqualTo(405);
        assertThat(r.contentType()).startsWith("application/json");
        assertThat(r.corpo().get("erro").asText()).isEqualTo("método não permitido");
    }

    // ---------- POST /items ----------

    @Test
    void criaItemEPersiste() throws Exception {
        Resposta r = post("{\"nome\":\"teclado\",\"quantidade\":3}");
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.corpo().toString()).isEqualTo("{\"id\":3,\"nome\":\"teclado\",\"quantidade\":3}");

        assertThat(get("/items/3").status()).isEqualTo(200);
        assertThat(noBanco()).isEqualTo("[{\"id\":1,\"nome\":\"notebook\",\"quantidade\":2},"
                + "{\"id\":2,\"nome\":\"monitor\",\"quantidade\":1},"
                + "{\"id\":3,\"nome\":\"teclado\",\"quantidade\":3}]");
    }

    @Test
    void quantidadePadraoEhUmENomeSemEspacos() throws Exception {
        Resposta r = post("{\"nome\":\"  mouse  \"}");
        assertThat(r.status()).isEqualTo(201);
        assertThat(r.corpo().get("nome").asText()).isEqualTo("mouse");
        assertThat(r.corpo().get("quantidade").asInt()).isEqualTo(1);
    }

    @Test
    void quantidadeZeroEhValida() throws Exception {
        assertThat(post("{\"nome\":\"cabo\",\"quantidade\":0}").status()).isEqualTo(201);
    }

    @Test
    void quantidadeMaximaCabeNoBigint() throws Exception {
        Resposta r = post("{\"nome\":\"x\",\"quantidade\":" + Long.MAX_VALUE + "}");
        assertThat(r.status()).isEqualTo(201);
        assertThat(get("/items/3").corpo().get("quantidade").asLong()).isEqualTo(Long.MAX_VALUE);
    }

    @ParameterizedTest
    @ValueSource(strings = {"isto não é json", "[1,2]", "\"texto\"", "42", "null", "", "{\"nome\":\"a\"} lixo"})
    void corpoQueNaoEhObjetoJson400(String corpo) throws Exception {
        Resposta r = post(corpo);
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.corpo().get("erro").asText()).isEqualTo("corpo deve ser um JSON válido");
    }

    @Test
    void semContentTypeJson400() throws Exception {
        assertThat(post("{\"nome\":\"x\"}", "text/plain").status()).isEqualTo(400);
        assertThat(post("{\"nome\":\"x\"}", null).status()).isEqualTo(400);
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"nome\":\"\"}", "{\"nome\":\"   \"}", "{\"nome\":123}",
            "{\"nome\":null}", "{\"nome\":[\"a\"]}", "{\"quantidade\":2}", "{\"nome\":\"a\\u0000b\"}"})
    void nomeInvalido422(String corpo) throws Exception {
        Resposta r = post(corpo);
        assertThat(r.status()).isEqualTo(422);
        assertThat(r.corpo().get("erro").asText()).isEqualTo("campo 'nome' é obrigatório e deve ser texto");
    }

    @ParameterizedTest
    @ValueSource(strings = {"-1", "\"3\"", "1.5", "3.0", "true", "null", "[]", "99999999999999999999999"})
    void quantidadeInvalida422(String quantidade) throws Exception {
        Resposta r = post("{\"nome\":\"x\",\"quantidade\":" + quantidade + "}");
        assertThat(r.status()).isEqualTo(422);
        assertThat(r.corpo().get("erro").asText()).isEqualTo("campo 'quantidade' deve ser inteiro >= 0");
    }

    @Test
    void postsConcorrentesGeramIdsUnicos() throws Exception {
        List<CompletableFuture<HttpResponse<String>>> futuros = new ArrayList<>();
        IntStream.range(0, 30).forEach(i -> futuros.add(http.sendAsync(
                req("/items").header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString("{\"nome\":\"item" + i + "\"}")).build(),
                HttpResponse.BodyHandlers.ofString())));

        Set<Long> ids = new HashSet<>();
        for (var f : futuros) {
            HttpResponse<String> r = f.join();
            assertThat(r.statusCode()).isEqualTo(201);
            ids.add(json.readTree(r.body()).get("id").asLong());
        }
        assertThat(ids).hasSize(30);
        assertThat(get("/items").corpo().get("total").asInt()).isEqualTo(32);
        assertThat(banco.sql("SELECT count(DISTINCT id) FROM items").query(Long.class).single()).isEqualTo(32);
    }

    // ---------- PUT /items/{id} ----------

    Resposta put(String caminho, String corpo) throws Exception {
        return enviar(req(caminho).header("Content-Type", "application/json")
                .PUT(HttpRequest.BodyPublishers.ofString(corpo)));
    }

    Resposta delete(String caminho) throws Exception {
        return enviar(req(caminho).DELETE());
    }

    @Test
    void putAtualizaEPersiste() throws Exception {
        Resposta r = put("/items/1", "{\"nome\":\" notebook pro \",\"quantidade\":5}");
        assertThat(r.status()).isEqualTo(200);
        assertThat(r.corpo().toString()).isEqualTo("{\"id\":1,\"nome\":\"notebook pro\",\"quantidade\":5}");
        assertThat(get("/items/1").corpo().get("nome").asText()).isEqualTo("notebook pro");
        assertThat(noBanco()).isEqualTo("[{\"id\":1,\"nome\":\"notebook pro\",\"quantidade\":5},"
                + "{\"id\":2,\"nome\":\"monitor\",\"quantidade\":1}]");
    }

    @Test
    void putSemQuantidadeUsaPadraoUm() throws Exception {
        assertThat(put("/items/1", "{\"nome\":\"x\"}").corpo().get("quantidade").asInt()).isEqualTo(1);
    }

    @Test
    void putIdInexistente404() throws Exception {
        Resposta r = put("/items/999", "{\"nome\":\"x\",\"quantidade\":1}");
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.corpo().toString()).isEqualTo("{\"erro\":\"item não encontrado\",\"id\":999}");
    }

    @ParameterizedTest
    @ValueSource(strings = {"[1]", "lixo", ""})
    void putCorpoInvalido400(String corpo) throws Exception {
        Resposta r = put("/items/1", corpo);
        assertThat(r.status()).isEqualTo(400);
        assertThat(r.corpo().get("erro").asText()).isEqualTo("corpo deve ser um JSON válido");
    }

    @ParameterizedTest
    @ValueSource(strings = {"{}", "{\"nome\":\"\"}", "{\"nome\":1}", "{\"nome\":\"x\",\"quantidade\":-1}",
            "{\"nome\":\"x\",\"quantidade\":\"2\"}", "{\"nome\":\"x\",\"quantidade\":1.5}"})
    void putValidacao422(String corpo) throws Exception {
        assertThat(put("/items/1", corpo).status()).isEqualTo(422);
        assertThat(get("/items/1").corpo().get("nome").asText()).isEqualTo("notebook"); // não mudou
    }

    // ---------- DELETE /items/{id} ----------

    @Test
    void deleteRemove204SemCorpo() throws Exception {
        HttpResponse<String> r = http.send(req("/items/1").DELETE().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(r.statusCode()).isEqualTo(204);
        assertThat(r.body()).isEmpty();
        assertThat(get("/items/1").status()).isEqualTo(404);
        assertThat(noBanco()).isEqualTo("[{\"id\":2,\"nome\":\"monitor\",\"quantidade\":1}]");
    }

    @Test
    void deleteIdInexistente404() throws Exception {
        Resposta r = delete("/items/999");
        assertThat(r.status()).isEqualTo(404);
        assertThat(r.corpo().toString()).isEqualTo("{\"erro\":\"item não encontrado\",\"id\":999}");
    }

    @Test
    void proximoIdEhMaiorExistenteMaisUmNaoAContagem() throws Exception {
        post("{\"nome\":\"a\"}"); // 3
        post("{\"nome\":\"b\"}"); // 4
        assertThat(delete("/items/2").status()).isEqualTo(204);
        // 3 itens restam (1, 3, 4): pela contagem o próximo seria 4 (repetido); deve ser 5
        assertThat(post("{\"nome\":\"c\"}").corpo().get("id").asInt()).isEqualTo(5);
    }

    @Test
    void idDoMaiorExcluidoNaoEhReaproveitado() throws Exception {
        assertThat(post("{\"nome\":\"a\"}").corpo().get("id").asInt()).isEqualTo(3);
        assertThat(delete("/items/3").status()).isEqualTo(204);
        // o identity do Postgres só anda para frente (no JSON antigo o 3 voltava)
        assertThat(post("{\"nome\":\"b\"}").corpo().get("id").asInt()).isEqualTo(4);
    }

    @Test
    void listaVaziaContinuaVazia() throws Exception {
        delete("/items/1");
        delete("/items/2");
        assertThat(get("/items").corpo().toString()).isEqualTo("{\"items\":[],\"total\":0}");
        assertThat(get("/health").corpo().get("total").asInt()).isZero();
    }

    @Test
    void rotaInexistenteComOutrosMetodosContinua404() throws Exception {
        assertThat(delete("/nao-existe").status()).isEqualTo(404);
        assertThat(enviar(req("/nao-existe").POST(HttpRequest.BodyPublishers.noBody())).status()).isEqualTo(404);
        assertThat(delete("/items/abc").status()).isEqualTo(404);
    }

    // ---------- frontend ----------

    @Test
    void frontendServidoNaRaiz() throws Exception {
        HttpResponse<String> r = http.send(req("/").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(r.statusCode()).isEqualTo(200);
        assertThat(r.headers().firstValue("Content-Type").orElse("")).startsWith("text/html");
        assertThat(r.body()).contains("<title>Items</title>").contains("/app.js").contains("/style.css");

        HttpResponse<String> js = http.send(req("/app.js").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(js.statusCode()).isEqualTo(200);
        assertThat(js.headers().firstValue("Content-Type").orElse("")).contains("javascript");

        HttpResponse<String> css = http.send(req("/style.css").GET().build(), HttpResponse.BodyHandlers.ofString());
        assertThat(css.statusCode()).isEqualTo(200);
        assertThat(css.headers().firstValue("Content-Type").orElse("")).startsWith("text/css");
    }

    @Test
    void frontendNaoUsaRecursoExterno() throws Exception {
        for (String arquivo : List.of("/", "/app.js", "/style.css")) {
            String corpo = http.send(req(arquivo).GET().build(), HttpResponse.BodyHandlers.ofString()).body();
            assertThat(corpo).as(arquivo).doesNotContain("http://").doesNotContain("https://");
        }
    }
}
