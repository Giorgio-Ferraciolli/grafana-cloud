// Teste de carga das duas APIs (flask-lab-api e java-lab-api).
// Para cada API, durante DURATION (padrão 10m), em paralelo:
//   POST /items        5 req/s  -> cria "item-teste-N" com quantidade N
//   GET  /items       10 req/s  -> lista tudo
//   GET  /items/{id}   5 req/s  -> busca um id já criado (404 é aceito)
import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';

const DURATION = __ENV.DURATION || '10m';
const APIS = {
  flask: __ENV.FLASK_URL || 'http://flask-lab-api:5000',
  java: __ENV.JAVA_URL || 'http://java-lab-api:5050',
};
const POST_RATE = 5;

function cenario(fn, api, rate) {
  return {
    executor: 'constant-arrival-rate',
    exec: fn,
    env: { API: api },
    rate,
    timeUnit: '1s',
    duration: DURATION,
    preAllocatedVUs: 10,
    maxVUs: 50,
    tags: { api },
  };
}

export const options = {
  scenarios: {
    flask_post: cenario('postItem', 'flask', POST_RATE),
    flask_list: cenario('listItems', 'flask', 10),
    flask_get: cenario('getItem', 'flask', 5),
    java_post: cenario('postItem', 'java', POST_RATE),
    java_list: cenario('listItems', 'java', 10),
    java_get: cenario('getItem', 'java', 5),
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{api:flask}': ['p(95)<1000'],
    'http_req_duration{api:java}': ['p(95)<1000'],
  },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

const base = () => APIS[__ENV.API];

export function postItem() {
  // Contador único e sequencial por cenário: 1, 2, 3...
  const n = exec.scenario.iterationInTest + 1;
  const res = http.post(
    `${base()}/items`,
    JSON.stringify({ nome: `item-teste-${n}`, quantidade: n }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'POST /items' } },
  );
  check(res, { 'POST 201': (r) => r.status === 201 });
}

export function listItems() {
  const res = http.get(`${base()}/items`, { tags: { name: 'GET /items' } });
  check(res, { 'GET lista 200': (r) => r.status === 200 });
}

export function getItem() {
  // Estima quantos itens já foram criados pelo tempo decorrido
  const criados = Math.max(1, Math.floor(((Date.now() - exec.scenario.startTime) / 1000) * POST_RATE));
  const id = 1 + Math.floor(Math.random() * criados);
  const res = http.get(`${base()}/items/${id}`, {
    tags: { name: 'GET /items/{id}' },
    responseCallback: http.expectedStatuses(200, 404),
  });
  check(res, { 'GET id 200/404': (r) => r.status === 200 || r.status === 404 });
}
