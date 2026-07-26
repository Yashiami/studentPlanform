FROM golang:1.25-alpine
RUN apk add --no-cache nodejs npm
WORKDIR /app
COPY . .
RUN cd scripts && npm install docx
RUN go build -o main .
EXPOSE 8080
CMD ["./main"]
