package models

type Aggregation struct {
	Field     string `json:"field"`
	Operation string `json:"operation"`
}

type Filter struct {
	Field    string      `json:"field"`
	Operator string      `json:"operator"`
	Value    interface{} `json:"value"`
	Logic    string      `json:"logic"`
}

type Having struct {
	Field     string  `json:"field"`
	Operation string  `json:"operation"`
	Operator  string  `json:"operator"`
	Value     float64 `json:"value"`
}

type OrderBy struct {
	Field     string `json:"field"`
	Direction string `json:"direction"` // "ASC" | "DESC"
}

type ChartConfig struct {
	VisualizationType string        `json:"visualization_type"`
	GroupBy           []string      `json:"group_by"`
	Aggregations      []Aggregation `json:"aggregations"`
	Filters           []Filter      `json:"filters"`
	Having            []Having      `json:"having"`
	OrderBy           []OrderBy     `json:"order_by"`
	Limit             int           `json:"limit"`
	Offset            int           `json:"offset"`
	BucketSize        float64       `json:"bucket_size"`
	BucketField       string        `json:"bucket_field"`
}

type RequestPayload struct {
	TableName              string        `json:"table_name"`
	DashboardConfiguration []ChartConfig `json:"dashboard_configuration"`
}
