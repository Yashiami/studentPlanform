# Використовуємо офіційний легкий образ Go
FROM golang:1.22-alpine

# Встановлюємо Node.js та npm, оскільки вони потрібні для скрипта generate_report.js
RUN apk add --no-cache nodejs npm

# Створюємо робочу директорію
WORKDIR /app

# Копіюємо всі файли проєкту в контейнер
COPY . .

# Переходимо в папку scripts і встановлюємо бібліотеку docx
RUN cd scripts && npm install docx

# Збираємо Go-застосунок
RUN go build -o main .

# Відкриваємо порт 8080
EXPOSE 8080

# Запускаємо скомпільований сервер
CMD ["./main"]