package main

import (
	"fmt"
	"net/http"

	"studentPlatform/database"
	"studentPlatform/routing"
)

func main() {
	database.InitDB()
	fmt.Println("Database connected. System tables initialized.")
	mux := routing.SetupRouter()
	if err := http.ListenAndServe(":8080", mux); err != nil {
		panic(err)
	}
}
