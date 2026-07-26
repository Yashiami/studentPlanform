package database

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/joho/godotenv/autoload"
)

var DB *sql.DB

func InitDB() {
	password := os.Getenv("DB_PASSWORD")
	if password == "" {
		panic("DB_PASSWORD not set")
	}
	dbHost := os.Getenv("DB_HOST")
	if dbHost == "" {
		dbHost = "localhost"
	}
	connName := fmt.Sprintf("postgres://postgres:%s@%s:5432/studentPlatform?sslmode=disable", password, dbHost)
	var err error
	DB, err = sql.Open("pgx", connName)
	if err != nil {
		panic(err)
	}
	createSystemTables()
}

func createSystemTables() {
	query := `
	CREATE TABLE IF NOT EXISTS _reports (
		id         SERIAL PRIMARY KEY,
		name       TEXT NOT NULL,
		table_name TEXT NOT NULL,
		config     TEXT NOT NULL,
		data       TEXT NOT NULL,
		created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
	);`
	if _, err := DB.Exec(query); err != nil {
		fmt.Printf("Warning: could not create _reports table: %v\n", err)
	}
}
