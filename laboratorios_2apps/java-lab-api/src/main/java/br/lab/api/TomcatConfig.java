package br.lab.api;

import org.apache.catalina.Valve;
import org.apache.catalina.core.StandardHost;
import org.apache.catalina.valves.ErrorReportValve;
import org.springframework.boot.web.embedded.tomcat.TomcatServletWebServerFactory;
import org.springframework.boot.web.server.WebServerFactoryCustomizer;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;

/** Troca a ErrorReportValve (HTML) do Tomcat pela versão JSON. Roda por último. */
@Component
public class TomcatConfig implements WebServerFactoryCustomizer<TomcatServletWebServerFactory>, Ordered {

    @Override
    public void customize(TomcatServletWebServerFactory factory) {
        factory.addContextCustomizers(context -> {
            if (context.getParent() instanceof StandardHost host) {
                for (Valve v : host.getPipeline().getValves()) {
                    if (v instanceof ErrorReportValve) {
                        host.getPipeline().removeValve(v);
                    }
                }
                host.setErrorReportValveClass(JsonErrorReportValve.class.getName());
                host.getPipeline().addValve(new JsonErrorReportValve());
            }
        });
    }

    @Override
    public int getOrder() {
        return Ordered.LOWEST_PRECEDENCE;
    }
}
