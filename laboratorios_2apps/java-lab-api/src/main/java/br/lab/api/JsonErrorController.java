package br.lab.api;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Substitui o /error padrão do Spring Boot (que devolve HTML para navegadores).
 * Pega erros que acontecem fora dos controllers, no nível do Tomcat.
 */
@RestController
public class JsonErrorController implements ErrorController {

    @RequestMapping("/error")
    public ResponseEntity<Map<String, Object>> erro(HttpServletRequest request) {
        Object codigo = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        HttpStatus status = HttpStatus.INTERNAL_SERVER_ERROR;
        if (codigo instanceof Integer c) {
            HttpStatus resolvido = HttpStatus.resolve(c);
            if (resolvido != null) {
                status = resolvido;
            }
        }
        String mensagem = switch (status) {
            case NOT_FOUND -> "rota não encontrada";
            case METHOD_NOT_ALLOWED -> "método não permitido";
            case BAD_REQUEST -> "requisição inválida";
            case INTERNAL_SERVER_ERROR -> "erro interno; veja 'docker logs java-lab-api'";
            default -> status.getReasonPhrase();
        };
        return ItemController.erro(status, mensagem);
    }
}
