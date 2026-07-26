package helperFunc

import (
	"database/sql"
	"fmt"
	"strings"

	"studentPlatform/database"
)

type ColumnStat struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"`
	NullCount    int         `json:"null_count"`
	UniqueValues int         `json:"unique_values"`
	Min          interface{} `json:"min,omitempty"`
	Max          interface{} `json:"max,omitempty"`
	Avg          interface{} `json:"avg,omitempty"`
	TopValues    []TopValue  `json:"top_values,omitempty"`
}

type TopValue struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

type TableProfile struct {
	TableName        string       `json:"table_name"`
	TotalRows        int          `json:"total_rows"`
	Columns          []ColumnStat `json:"columns"`
	SuggestedGroupBy []string     `json:"suggested_groupby"`
	SuggestedMetrics []string     `json:"suggested_metrics"`
}

func BuildTableProfile(tableName string) (*TableProfile, error) {
	var totalRows int
	if err := database.DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %q", tableName)).Scan(&totalRows); err != nil {
		return nil, err
	}

	// Отримуємо назви колонок та їх типи
	rows, err := database.DB.Query(fmt.Sprintf("SELECT * FROM %q LIMIT 0", tableName))
	if err != nil {
		return nil, err
	}
	colTypes, err := rows.ColumnTypes()
	rows.Close()
	if err != nil {
		return nil, err
	}

	profile := &TableProfile{
		TableName: tableName,
		TotalRows: totalRows,
	}

	for _, ct := range colTypes {
		colName := ct.Name()
		dbType := ct.DatabaseTypeName()

		stat := ColumnStat{
			Name: colName,
			Type: dbType,
		}

		// NULL count
		_ = database.DB.QueryRow(
			fmt.Sprintf("SELECT COUNT(*) FROM %q WHERE %q IS NULL", tableName, colName),
		).Scan(&stat.NullCount)

		// Unique count
		_ = database.DB.QueryRow(
			fmt.Sprintf("SELECT COUNT(DISTINCT %q) FROM %q", colName, tableName),
		).Scan(&stat.UniqueValues)

		isNumeric := isNumericType(dbType)

		if isNumeric {
			// Числова колонка: MIN, MAX, AVG
			var minVal, maxVal, avgVal sql.NullFloat64
			_ = database.DB.QueryRow(
				fmt.Sprintf("SELECT MIN(%q), MAX(%q), AVG(%q) FROM %q", colName, colName, colName, tableName),
			).Scan(&minVal, &maxVal, &avgVal)
			if minVal.Valid {
				stat.Min = minVal.Float64
			}
			if maxVal.Valid {
				stat.Max = maxVal.Float64
			}
			if avgVal.Valid {
				rounded := float64(int(avgVal.Float64*100)) / 100
				stat.Avg = rounded
			}
			profile.SuggestedMetrics = append(profile.SuggestedMetrics, colName)
		} else {
			topRows, err := database.DB.Query(
				fmt.Sprintf(
					"SELECT %q::TEXT, COUNT(*) AS cnt FROM %q GROUP BY %q ORDER BY cnt DESC LIMIT 3",
					colName, tableName, colName,
				),
			)
			if err == nil {
				for topRows.Next() {
					var tv TopValue
					_ = topRows.Scan(&tv.Value, &tv.Count)
					stat.TopValues = append(stat.TopValues, tv)
				}
				topRows.Close()
			}
			if stat.UniqueValues > 0 && stat.UniqueValues <= 50 {
				profile.SuggestedGroupBy = append(profile.SuggestedGroupBy, colName)
			}
		}

		profile.Columns = append(profile.Columns, stat)
	}

	return profile, nil
}

func isNumericType(dbType string) bool {
	t := strings.ToUpper(dbType)
	return strings.Contains(t, "INT") ||
		strings.Contains(t, "FLOAT") ||
		strings.Contains(t, "NUMERIC") ||
		strings.Contains(t, "DECIMAL") ||
		t == "REAL" || t == "DOUBLE PRECISION"
}
