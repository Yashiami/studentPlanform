package helperFunc

import (
	"database/sql"
	"fmt"
	"regexp"
	"strings"

	"studentPlatform/database"
	"studentPlatform/models"
)

type RegionMapping struct {
	Pattern *regexp.Regexp
	City    string
}

var regionMatchers = []RegionMapping{
	{regexp.MustCompile(`(?i)(київ|київськ)`), "Київ"},
	{regexp.MustCompile(`(?i)(львів|львівськ)`), "Львів"},
	{regexp.MustCompile(`(?i)(харків|харківськ)`), "Харків"},
	{regexp.MustCompile(`(?i)(одес|одеськ)`), "Одеса"},
	{regexp.MustCompile(`(?i)(дніпро|дніпропетровськ)`), "Дніпро"},
	{regexp.MustCompile(`(?i)(запоріжжя|запорізьк)`), "Запоріжжя"},
	{regexp.MustCompile(`(?i)(івано-франківськ)`), "Івано-Франківськ"},
	{regexp.MustCompile(`(?i)(тернопіль|тернопільськ)`), "Тернопіль"},
	{regexp.MustCompile(`(?i)(рівне|рівненськ)`), "Рівне"},
	{regexp.MustCompile(`(?i)(хмельницьк)`), "Хмельницький"},
	{regexp.MustCompile(`(?i)(вінниця|вінницьк)`), "Вінниця"},
	{regexp.MustCompile(`(?i)(житомир|житомирськ)`), "Житомир"},
	{regexp.MustCompile(`(?i)(чернігів|чернігівськ)`), "Чернігів"},
	{regexp.MustCompile(`(?i)(суми|сумськ)`), "Суми"},
	{regexp.MustCompile(`(?i)(полтава|полтавськ)`), "Полтава"},
	{regexp.MustCompile(`(?i)(черкаси|черкаськ)`), "Черкаси"},
	{regexp.MustCompile(`(?i)(кропивницьк|кіровоградськ)`), "Кропивницький"},
	{regexp.MustCompile(`(?i)(миколаїв|миколаївськ)`), "Миколаїв"},
	{regexp.MustCompile(`(?i)(херсон|херсонськ)`), "Херсон"},
	{regexp.MustCompile(`(?i)(чернівці|чернівецьк)`), "Чернівці"},
	{regexp.MustCompile(`(?i)(ужгород|закарпатськ)`), "Закарпаття"},
	{regexp.MustCompile(`(?i)(луцьк|волинськ)`), "Волинь"},
	{regexp.MustCompile(`(?i)(луганськ)`), "Луганськ"},
	{regexp.MustCompile(`(?i)(донецьк)`), "Донецьк"},
	{regexp.MustCompile(`(?i)(крим|сімферополь)`), "Крим"},
}

func normalizeAddress(raw interface{}) (string, bool) {
	var strVal string
	switch v := raw.(type) {
	case []byte:
		strVal = string(v)
	case string:
		strVal = v
	default:
		return "", false
	}
	if strVal == "" {
		return "", false
	}
	for _, rm := range regionMatchers {
		if rm.Pattern.MatchString(strVal) {
			return rm.City, true
		}
	}
	return "", false
}

func ResponseWithData(tableName string, query string, args []interface{}, config models.ChartConfig) (models.ChartResponse, error) {
	rows, err := database.DB.Query(query, args...)
	if err != nil {
		return models.ChartResponse{}, fmt.Errorf("query error: %w", err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return models.ChartResponse{}, err
	}

	var result []map[string]interface{}
	for rows.Next() {
		values := make([]interface{}, len(cols))
		valuePtrs := make([]interface{}, len(cols))
		for i := range values {
			valuePtrs[i] = &values[i]
		}
		if err := rows.Scan(valuePtrs...); err != nil {
			return models.ChartResponse{}, err
		}
		row := make(map[string]interface{})
		for i, col := range cols {
			if strings.ToLower(col) == "address" {
				if normalized, ok := normalizeAddress(values[i]); ok {
					row[col] = normalized
					continue
				}
			}
			if b, ok := values[i].([]byte); ok {
				row[col] = string(b)
			} else {
				row[col] = values[i]
			}
		}
		result = append(result, row)
	}

	aggField := ""
	if len(config.Aggregations) > 0 {
		agg := config.Aggregations[0]
		if agg.Field == "*" {
			aggField = strings.ToLower(agg.Operation) + "_all"
		} else {
			aggField = strings.ToLower(agg.Operation) + "_" + agg.Field
		}
	} else if config.VisualizationType == "histogram" {
		aggField = "count"
	}

	AddSharePercent(result, aggField)

	quality := computeDataQuality(tableName, config)

	summary, _, insights := EnrichResponse(result, aggField, tableName, nil)

	return models.ChartResponse{
		Data:        result,
		Summary:     summary,
		DataQuality: quality,
		Insights:    insights,
		Query:       query,
	}, nil
}

func computeDataQuality(tableName string, config models.ChartConfig) *models.DataQuality {
	dq := &models.DataQuality{}

	var total int
	_ = database.DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %q", tableName)).Scan(&total)
	dq.TotalSourceRows = total

	var fields []string
	for _, g := range config.GroupBy {
		fields = append(fields, g)
	}
	for _, a := range config.Aggregations {
		if a.Field != "*" {
			fields = append(fields, a.Field)
		}
	}

	nullCount := 0
	if len(fields) > 0 {
		var conditions []string
		for _, f := range fields {
			conditions = append(conditions, fmt.Sprintf("%q IS NULL", f))
		}
		q := fmt.Sprintf("SELECT COUNT(*) FROM %q WHERE %s", tableName, strings.Join(conditions, " OR "))
		_ = database.DB.QueryRow(q).Scan(&nullCount)
	}

	dq.RowsWithNullsExcluded = nullCount
	dq.RowsUsed = total - nullCount
	if total > 0 {
		dq.CompletenessPercent = float64(dq.RowsUsed) / float64(total) * 100
	}
	return dq
}

func GetColumnNamesAndTypes(tableName string) ([]*sql.ColumnType, error) {
	rows, err := database.DB.Query(fmt.Sprintf("SELECT * FROM %q LIMIT 0", tableName))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return rows.ColumnTypes()
}
