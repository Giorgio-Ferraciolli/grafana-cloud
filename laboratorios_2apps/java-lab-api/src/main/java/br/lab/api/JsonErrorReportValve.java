package br.lab.api;

import org.apache.catalina.connector.Request;
import org.apache.catalina.connector.Response;
import org.apache.catalina.valves.ErrorReportValve;

import java.io.IOException;
import java.io.Writer;
import java.nio.charset.StandardCharsets;

/**
 * Página de erro do próprio Tomcat em JSON. Cobre o que é rejeitado antes de chegar
 * no Spring (ex.: URL malformada como /items/%), que por padrão vira HTML.
 */
public class JsonErrorReportValve extends ErrorReportValve {

    @Override
    protected void report(Request request, Response response, Throwable erro) {
        int status = response.getStatus();
        if (status < 400 || response.getContentWritten() > 0 || !response.setErrorReported()) {
            return;
        }
        String mensagem = switch (status) {
            case 400 -> "requisição inválida";
            case 404 -> "rota não encontrada";
            case 405 -> "método não permitido";
            default -> status >= 500 ? "erro interno; veja 'docker logs java-lab-api'" : "erro HTTP " + status;
        };
        try {
            response.setContentType("application/json");
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            Writer w = response.getReporter();
            if (w != null) {
                w.write("{\"erro\":\"" + mensagem + "\"}");
                response.finishResponse();
            }
        } catch (IOException | IllegalStateException e) {
            // resposta já comprometida; nada a fazer
        }
    }
}
