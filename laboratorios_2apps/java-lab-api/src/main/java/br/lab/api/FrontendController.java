package br.lab.api;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** GET / entrega a interface (static/index.html). */
@RestController
public class FrontendController {

    private final Resource index = new ClassPathResource("static/index.html");

    @GetMapping("/")
    public ResponseEntity<Resource> index() {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(index);
    }
}
