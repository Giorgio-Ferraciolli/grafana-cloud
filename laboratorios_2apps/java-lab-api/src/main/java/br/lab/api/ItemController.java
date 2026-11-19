package br.lab.api;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class ItemController {

    private final ItemStore store;
    private final ObjectMapper leitor;

    public ItemController(ItemStore store, ObjectMapper mapper) {
        this.store = store;
        // Rejeita lixo depois do JSON, como o json.loads do Python
        this.leitor = mapper.copy().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    }

    /** Healthcheck que consulta o banco: se ele estiver inacessível, responde 503. */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        try {
            long total = store.contar();
            return ResponseEntity.ok(Map.of("status", "ok", "total", total));
        } catch (RuntimeException e) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(Map.of(
                    "status", "erro",
                    "detalhe", "banco de dados inacessível: " + NestedExceptionUtils.getMostSpecificCause(e)));
        }
    }

    @GetMapping("/items")
    public Map<String, Object> listar(@RequestParam(required = false) String nome) {
        List<Item> items;
        if (nome == null || nome.isEmpty()) {
            items = store.listar();
        } else if (nome.indexOf('\0') >= 0) {
            items = List.of(); // nenhum nome no banco pode ter \0
        } else {
            items = store.filtrar(nome);
        }
        return Map.of("total", items.size(), "items", items);
    }

    // \d+ espelha o <int:item_id> do Flask: /items/abc cai em "rota não encontrada"
    @GetMapping("/items/{id:\\d+}")
    public ResponseEntity<?> buscar(@PathVariable long id) {
        return store.buscar(id)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> naoEncontrado(id));
    }

    @PostMapping("/items")
    public ResponseEntity<Item> criar(
            @RequestHeader(value = "Content-Type", required = false) String contentType,
            @RequestBody(required = false) byte[] corpo) {
        Campos c = validar(contentType, corpo);
        return ResponseEntity.status(HttpStatus.CREATED).body(store.criar(c.nome(), c.quantidade()));
    }

    /** Substitui o item inteiro. Mesmas validações do POST (quantidade ausente = 1). */
    @PutMapping("/items/{id:\\d+}")
    public ResponseEntity<?> atualizar(
            @PathVariable long id,
            @RequestHeader(value = "Content-Type", required = false) String contentType,
            @RequestBody(required = false) byte[] corpo) {
        Campos c = validar(contentType, corpo);
        return store.atualizar(id, c.nome(), c.quantidade())
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> naoEncontrado(id));
    }

    @DeleteMapping("/items/{id:\\d+}")
    public ResponseEntity<?> excluir(@PathVariable long id) {
        return store.excluir(id) ? ResponseEntity.noContent().build() : naoEncontrado(id);
    }

    private record Campos(String nome, long quantidade) {}

    private Campos validar(String contentType, byte[] corpo) {
        JsonNode dados = lerJson(contentType, corpo);
        if (dados == null || !dados.isObject()) {
            throw new ValidacaoException(HttpStatus.BAD_REQUEST, "corpo deve ser um JSON válido");
        }

        JsonNode nome = dados.get("nome");
        // \0 não cabe num text do Postgres
        if (nome == null || !nome.isTextual() || nome.asText().isBlank() || nome.asText().indexOf('\0') >= 0) {
            throw new ValidacaoException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "campo 'nome' é obrigatório e deve ser texto");
        }

        long quantidade = 1;
        if (dados.has("quantidade")) {
            JsonNode q = dados.get("quantidade");
            // isIntegralNumber exclui true/false, 1.5, "3" e null
            if (!q.isIntegralNumber() || !q.canConvertToLong() || q.asLong() < 0) {
                throw new ValidacaoException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "campo 'quantidade' deve ser inteiro >= 0");
            }
            quantidade = q.asLong();
        }
        return new Campos(nome.asText().strip(), quantidade);
    }

    /** Igual ao request.get_json(silent=True): exige Content-Type JSON e corpo parseável. */
    private JsonNode lerJson(String contentType, byte[] corpo) {
        if (contentType == null || corpo == null || corpo.length == 0) {
            return null;
        }
        try {
            MediaType tipo = MediaType.parseMediaType(contentType);
            boolean ehJson = "application".equals(tipo.getType())
                    && ("json".equals(tipo.getSubtype()) || tipo.getSubtype().endsWith("+json"));
            return ehJson ? leitor.readTree(corpo) : null;
        } catch (IOException | IllegalArgumentException e) {
            return null;
        }
    }

    private static ResponseEntity<Map<String, Object>> naoEncontrado(long id) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("erro", "item não encontrado", "id", id));
    }

    static ResponseEntity<Map<String, Object>> erro(HttpStatus status, String mensagem) {
        Map<String, Object> corpo = new LinkedHashMap<>();
        corpo.put("erro", mensagem);
        return ResponseEntity.status(status).body(corpo);
    }
}
