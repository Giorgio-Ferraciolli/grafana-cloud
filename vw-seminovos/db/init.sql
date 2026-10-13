SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS vw_seminovos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vw_seminovos;

CREATE TABLE IF NOT EXISTS cars (
  id INT AUTO_INCREMENT PRIMARY KEY,
  model VARCHAR(50) NOT NULL,
  version VARCHAR(100) NOT NULL,
  category VARCHAR(30) NOT NULL,
  year INT NOT NULL,
  km INT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  color VARCHAR(30) NOT NULL,
  fuel VARCHAR(30) NOT NULL,
  transmission VARCHAR(30) NOT NULL,
  engine VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  image VARCHAR(100) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads (
  id INT AUTO_INCREMENT PRIMARY KEY,
  car_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(30) NOT NULL,
  message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (car_id) REFERENCES cars(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dados fictícios para laboratório
INSERT INTO cars (model, version, category, year, km, price, color, fuel, transmission, engine, description, image) VALUES
('Tera', 'Comfort 170 TSI', 'SUV compacto', 2025, 12500, 109900.00, 'Branco Puro', 'Flex', 'Automático 6 marchas', '1.0 TSI turbo 116 cv',
 'SUV compacto de único dono, revisões em dia na concessionária. Central multimídia VW Play, 6 airbags e frenagem autônoma de emergência.', 'tera.jpg'),
('Polo', 'Highline 170 TSI', 'Hatch', 2024, 28300, 96900.00, 'Cinza Platinum', 'Flex', 'Automático 6 marchas', '1.0 TSI turbo 116 cv',
 'Hatch completo com painel digital, faróis full LED e controle de cruzeiro adaptativo. Baixa quilometragem e garantia de fábrica.', 'polo.jpg'),
('Virtus', 'Exclusive 250 TSI', 'Sedã', 2024, 21700, 134900.00, 'Prata Sirius', 'Flex', 'Automático 6 marchas', '1.4 TSI turbo 150 cv',
 'Sedã topo de linha com porta-malas de 521 litros, bancos em couro, rodas de 18 polegadas e pacote completo de assistências.', 'virtus.jpg'),
('Taos', 'Highline 250 TSI', 'SUV médio', 2025, 9800, 189900.00, 'Cinza Moonstone', 'Flex', 'Automático 8 marchas', '1.4 TSI turbo 150 cv',
 'SUV médio seminovo com teto solar panorâmico, faróis IQ.Light, painel digital de 10 polegadas e amplo espaço interno.', 'taos.jpg');
