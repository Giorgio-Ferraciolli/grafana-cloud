package br.lab.api;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.HttpMediaTypeException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.Map;

/** Todo erro sai em JSON, nunca em HTML nem stack trace. */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler({NoHandlerFoundException.class, NoResourceFoundException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<Map<String, Object>> rotaInexistente(Exception e) {
        return ItemController.erro(HttpStatus.NOT_FOUND, "rota não encontrada");
    }

    @ExceptionHandler(ValidacaoException.class)
    public ResponseEntity<Map<String, Object>> validacao(ValidacaoException e) {
        return ItemController.erro(e.status(), e.getMessage());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<Map<String, Object>> metodoNaoPermitido(HttpRequestMethodNotSupportedException e) {
        return ItemController.erro(HttpStatus.METHOD_NOT_ALLOWED, "método não permitido");
    }

    @ExceptionHandler(HttpMediaTypeException.class)
    public ResponseEntity<Map<String, Object>> tipoDeMidia(HttpMediaTypeException e) {
        return ItemController.erro(HttpStatus.BAD_REQUEST, "corpo deve ser um JSON válido");
    }

    /** Banco fora do ar, recusando conexão ou pool sem conexão livre (inclui CannotGetJdbcConnectionException). */
    @ExceptionHandler(DataAccessResourceFailureException.class)
    public ResponseEntity<Map<String, Object>> bancoIndisponivel(DataAccessResourceFailureException e) {
        log.error("banco de dados indisponível: {}", NestedExceptionUtils.getMostSpecificCause(e).toString());
        return ItemController.erro(HttpStatus.SERVICE_UNAVAILABLE,
                "banco de dados indisponível; veja 'docker logs postgres-lab'");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> erroInterno(Exception e) {
        log.error("erro interno", e);
        return ItemController.erro(HttpStatus.INTERNAL_SERVER_ERROR,
                "erro interno; veja 'docker logs java-lab-api'");
    }
}
