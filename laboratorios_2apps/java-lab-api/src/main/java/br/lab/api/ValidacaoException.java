package br.lab.api;

import org.springframework.http.HttpStatus;

/** Body de POST/PUT inválido: vira {"erro": mensagem} com o status dado. */
public class ValidacaoException extends RuntimeException {
    private final HttpStatus status;

    public ValidacaoException(HttpStatus status, String mensagem) {
        super(mensagem);
        this.status = status;
    }

    public HttpStatus status() {
        return status;
    }
}
