package models

type ChartResponse struct {
	Data        []map[string]interface{} `json:"data"`
	Summary     *Summary                 `json:"summary,omitempty"`
	DataQuality *DataQuality             `json:"data_quality,omitempty"`
	Insights    []string                 `json:"insights,omitempty"`
	Query       string                   `json:"debug_query,omitempty"`
}

type Summary struct {
	TotalRows    int         `json:"total_rows"`
	GroupsCount  int         `json:"groups_count"`
	Max          *GroupValue `json:"max,omitempty"`
	Min          *GroupValue `json:"min,omitempty"`
	Average      float64     `json:"average"`
	Sum          float64     `json:"sum"`
	StdDeviation float64     `json:"std_deviation"`
}

type GroupValue struct {
	Group string  `json:"group"`
	Value float64 `json:"value"`
}

type DataQuality struct {
	TotalSourceRows       int     `json:"total_source_rows"`
	RowsWithNullsExcluded int     `json:"rows_with_nulls_excluded"`
	RowsUsed              int     `json:"rows_used"`
	CompletenessPercent   float64 `json:"completeness_percent"`
}
