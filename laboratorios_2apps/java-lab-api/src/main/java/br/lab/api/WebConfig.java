package br.lab.api;

import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.web.servlet.config.annotation.ContentNegotiationConfigurer;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    /** Ignora o header Accept: a API sempre responde JSON (navegador pedindo HTML não vira 406). */
    @Override
    public void configureContentNegotiation(ContentNegotiationConfigurer configurer) {
        configurer.ignoreAcceptHeader(true).defaultContentType(MediaType.APPLICATION_JSON);
    }

    /**
     * Só os arquivos do frontend, pelo nome. Não usamos o /** padrão do Spring Boot para
     * que POST/DELETE em rota inexistente continuem dando 404 "rota não encontrada".
     */
    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/app.js", "/style.css")
                .addResourceLocations("classpath:/static/");
    }
}
