package models

import "time"

type Report struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	TableName string    `json:"table_name"`
	Config    string    `json:"config"`
	Data      string    `json:"data"`
	CreatedAt time.Time `json:"created_at"`
}

type SaveReportRequest struct {
	Name      string          `json:"name"`
	TableName string          `json:"table_name"`
	Config    RequestPayload  `json:"config"`
	Data      []ChartResponse `json:"data"`
}

type CompareRequest struct {
	TableA    string `json:"table_a"`
	TableB    string `json:"table_b"`
	GroupBy   string `json:"group_by"`
	Operation string `json:"operation"`
	Field     string `json:"field"`
}

type CompareRow struct {
	Group        string  `json:"group"`
	ValueA       float64 `json:"value_a"`
	ValueB       float64 `json:"value_b"`
	Delta        float64 `json:"delta"`
	DeltaPercent float64 `json:"delta_percent"`
}

type CompareResponse struct {
	TableA string       `json:"table_a"`
	TableB string       `json:"table_b"`
	Field  string       `json:"field"`
	Data   []CompareRow `json:"data"`
}
