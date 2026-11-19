package br.lab.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Banco fora do ar (porta 1 recusa na hora): a API sobe mesmo assim e responde 503 em JSON. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = {
        "spring.datasource.url=jdbc:postgresql://127.0.0.1:1/lab?connectTimeout=2",
        "spring.datasource.username=lab_app",
        "spring.datasource.password=qualquer"})
class BancoForaTest {

    @LocalServerPort
    int porta;

    final HttpClient http = HttpClient.newHttpClient();
    final ObjectMapper json = new ObjectMapper();

    HttpResponse<String> enviar(HttpRequest.Builder req) throws Exception {
        return http.send(req.build(), HttpResponse.BodyHandlers.ofString());
    }

    HttpRequest.Builder req(String caminho) {
        return HttpRequest.newBuilder(URI.create("http://localhost:" + porta + caminho));
    }

    @Test
    void health503ComDetalhe() throws Exception {
        HttpResponse<String> r = enviar(req("/health").GET());
        assertThat(r.statusCode()).isEqualTo(503);
        JsonNode corpo = json.readTree(r.body());
        assertThat(corpo.get("status").asText()).isEqualTo("erro");
        assertThat(corpo.get("detalhe").asText()).startsWith("banco de dados inacessível");
    }

    @Test
    void rotasDeItems503EmJson() throws Exception {
        String post = "{\"nome\":\"x\"}";
        for (HttpRequest.Builder b : List.of(
                req("/items").GET(),
                req("/items?nome=a").GET(),
                req("/items/1").GET(),
                req("/items").header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(post)),
                req("/items/1").header("Content-Type", "application/json").PUT(HttpRequest.BodyPublishers.ofString(post)),
                req("/items/1").DELETE())) {
            HttpResponse<String> r = enviar(b);
            assertThat(r.statusCode()).isEqualTo(503);
            assertThat(r.headers().firstValue("Content-Type").orElse("")).startsWith("application/json");
            assertThat(json.readTree(r.body()).get("erro").asText())
                    .isEqualTo("banco de dados indisponível; veja 'docker logs postgres-lab'");
        }
    }

    @Test
    void validacaoNaoDependeDoBanco() throws Exception {
        HttpResponse<String> r = enviar(req("/items").header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString("{\"quantidade\":1}")));
        assertThat(r.statusCode()).isEqualTo(422);
    }

    @Test
    void frontendContinuaNoAr() throws Exception {
        assertThat(enviar(req("/").GET()).statusCode()).isEqualTo(200);
    }
}
