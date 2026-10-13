-- v2: mais carros, status das propostas, test drives e avaliações de usado.
-- Roda automaticamente em bancos novos (depois do init.sql).
-- Para um banco já existente, veja a seção "Atualizando um banco existente" do README.
SET NAMES utf8mb4;
USE vw_seminovos;

ALTER TABLE leads ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'novo';

CREATE TABLE IF NOT EXISTS test_drives (
  id INT AUTO_INCREMENT PRIMARY KEY,
  car_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  visit_date DATE NOT NULL,
  visit_time CHAR(5) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'agendado',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_slot (car_id, visit_date, visit_time),
  FOREIGN KEY (car_id) REFERENCES cars(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sell_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  km INT NOT NULL,
  car_condition VARCHAR(20) NOT NULL,
  estimate DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dados fictícios para laboratório
INSERT INTO cars (model, version, category, year, km, price, color, fuel, transmission, engine, description, image) VALUES
('Polo Track', '1.0 MPI', 'Hatch', 2024, 31500, 79900.00, 'Prata Sirius', 'Flex', 'Manual 5 marchas', '1.0 MPI 84 cv',
 'Porta de entrada da linha Polo: econômico, ar-condicionado, direção elétrica e central multimídia. Ideal para o dia a dia na cidade.', 'polotrack.jpg'),
('Polo', 'Comfortline 200 TSI', 'Hatch', 2023, 42800, 84900.00, 'Cinza Platinum', 'Flex', 'Automático 6 marchas', '1.0 TSI turbo 128 cv',
 'Polo automático com motor turbo, painel digital e câmbio de 6 marchas. Manual e chave reserva, revisões registradas.', 'polo.jpg'),
('Golf', 'GTI 2.0 TSI', 'Hatch', 2023, 18900, 259900.00, 'Cinza Dolphin', 'Gasolina', 'Automático DSG 7 marchas', '2.0 TSI turbo 245 cv',
 'O hot hatch mais famoso do mundo. Faróis IQ.Light, bancos esportivos com padrão xadrez, Head-Up Display e rodas aro 19.', 'golf.jpg'),
('Nivus', 'Highline 200 TSI', 'SUV compacto', 2024, 19400, 124900.00, 'Branco Cristal', 'Flex', 'Automático 6 marchas', '1.0 TSI turbo 128 cv',
 'SUV cupê com visual esportivo, painel digital, VW Play e pacote ACC com frenagem autônoma. Único dono.', 'nivus.jpg'),
('T-Cross', 'Highline 250 TSI', 'SUV compacto', 2024, 24600, 142900.00, 'Preto Ninja', 'Flex', 'Automático 6 marchas', '1.4 TSI turbo 150 cv',
 'SUV espaçoso com motor 1.4 TSI, teto solar, bancos em couro e assistente de permanência em faixa. Pneus novos.', 'tcross.jpg'),
('Tera', 'High 170 TSI', 'SUV compacto', 2025, 6200, 124900.00, 'Branco Puro', 'Flex', 'Automático 6 marchas', '1.0 TSI turbo 116 cv',
 'Versão topo do Tera praticamente zero: faróis full LED, painel digital de 10 polegadas e carregador por indução.', 'tera.jpg'),
('Jetta', 'GLI 350 TSI', 'Sedã', 2025, 8700, 219900.00, 'Azul Atlântico', 'Gasolina', 'Automático DSG 7 marchas', '2.0 TSI turbo 231 cv',
 'Sedã esportivo com bloqueio eletrônico do diferencial, freios com pinças vermelhas, som Beats e teto solar.', 'jetta.jpg'),
('Tiguan Allspace', 'R-Line 350 TSI', 'SUV médio', 2023, 33100, 229900.00, 'Cinza Indium', 'Gasolina', 'Automático 8 marchas', '2.0 TSI turbo 220 cv',
 'SUV de 7 lugares com tração 4Motion, acabamento R-Line, teto panorâmico e porta-malas elétrico.', 'tiguan.jpg'),
('ID.4', 'Pro', 'SUV médio', 2024, 14300, 249900.00, 'Vermelho Kings', 'Elétrico', 'Automático (marcha única)', 'Elétrico 204 cv',
 'SUV 100% elétrico com autonomia de até 400 km, recarga rápida DC e carregador de parede incluso.', 'id4.jpg'),
('Saveiro', 'Trendline Cabine Simples', 'Picape', 2024, 27900, 94900.00, 'Branco Cristal', 'Flex', 'Manual 5 marchas', '1.6 MSI 116 cv',
 'Picape compacta para trabalho e lazer, com caçamba de 1.100 litros, protetor de caçamba e engate.', 'saveiro.jpg'),
('Amarok', 'Extreme V6', 'Picape', 2023, 41200, 289900.00, 'Prata Pyrit', 'Diesel', 'Automático 8 marchas', '3.0 V6 TDI 258 cv',
 'Picape média mais potente da categoria, tração 4Motion permanente, bancos ergoComfort e capota marítima.', 'amarok.jpg');
