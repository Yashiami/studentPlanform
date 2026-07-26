package helperFunc

import (
	"fmt"
	"strings"

	"studentPlatform/database"
)

func InsertDataToDatabase(tableName string, headers []string, records [][]string) error {
	if len(records) == 0 {
		return nil
	}

	columnTypes, err := getColumnTypes(tableName)
	if err != nil {
		return fmt.Errorf("failed to get column types: %w", err)
	}

	var quotedHeaders []string
	for _, h := range headers {
		quotedHeaders = append(quotedHeaders, fmt.Sprintf("%q", h))
	}

	var valuePlaceholders []string
	var args []interface{}
	argIdx := 1

	for _, row := range records {
		var rowPlaceholders []string
		for i := range headers {
			val := ""
			if i < len(row) {
				val = strings.TrimSpace(row[i])
			}

			var finalVal interface{} = val
			if val == "" && i < len(columnTypes) {
				colType := strings.ToLower(columnTypes[i])
				// Перевіримо типи у нижньому регістрі
				if strings.Contains(colType, "integer") || strings.Contains(colType, "numeric") || strings.Contains(colType, "decimal") || strings.Contains(colType, "float") || strings.Contains(colType, "double") || strings.Contains(colType, "int") {
					finalVal = nil // NULL замість порожної строки для числових типів
				}
			}

			rowPlaceholders = append(rowPlaceholders, fmt.Sprintf("$%d", argIdx))
			args = append(args, finalVal)
			argIdx++
		}
		valuePlaceholders = append(valuePlaceholders, "("+strings.Join(rowPlaceholders, ", ")+")")
	}

	query := fmt.Sprintf(
		"INSERT INTO %q (%s) VALUES %s",
		tableName,
		strings.Join(quotedHeaders, ", "),
		strings.Join(valuePlaceholders, ", "),
	)

	_, err = database.DB.Exec(query, args...)
	return err
}

func getColumnTypes(tableName string) ([]string, error) {
	rows, err := database.DB.Query(`
		SELECT data_type 
		FROM information_schema.columns
		WHERE table_name = $1 AND table_schema = 'public'
		ORDER BY ordinal_position
	`, tableName)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var types []string
	for rows.Next() {
		var dataType string
		if err := rows.Scan(&dataType); err != nil {
			return nil, err
		}
		types = append(types, dataType)
	}
	return types, rows.Err()
}
