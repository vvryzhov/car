.PHONY: help build up down restart logs clean

help:
	@echo "Доступные команды:"
	@echo "  make build    - Собрать Docker образы"
	@echo "  make up       - Запустить контейнеры"
	@echo "  make down     - Остановить контейнеры"
	@echo "  make restart  - Перезапустить контейнеры"
	@echo "  make logs     - Показать логи"
	@echo "  make clean    - Удалить контейнеры и образы"

build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

