package helperFunc

import (
	"fmt"
	"strings"

	"studentPlatform/database"
)

func CreateTable(tableName string, headers []string, types []string) error {
	var columns []string
	for i, h := range headers {
		colType := "TEXT"
		if i < len(types) {
			colType = types[i]
		}
		columns = append(columns, fmt.Sprintf("%q %s", h, colType))
	}
	query := fmt.Sprintf("CREATE TABLE IF NOT EXISTS %q (%s)", tableName, strings.Join(columns, ", "))
	_, err := database.DB.Exec(query)
	return err
}
