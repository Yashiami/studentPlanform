package helperFunc

import (
	"fmt"
	"studentPlatform/database"
	"time"
)

type TableMeta struct {
	Name    string `json:"name"`
	Records int    `json:"records"`
	Columns int    `json:"columns"`
	Size    string `json:"size"`
	Created string `json:"created"`
}

func ListUserTables() ([]TableMeta, error) {
	rows, err := database.DB.Query(`
		SELECT table_name
		FROM information_schema.tables
		WHERE table_schema = 'public'
		  AND table_type = 'BASE TABLE'
		  AND table_name NOT LIKE '\_%'
		ORDER BY table_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tables []TableMeta
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			continue
		}
		meta := TableMeta{Name: name}

		err := database.DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM %q", name)).Scan(&meta.Records)
		if err != nil {
			fmt.Printf("Error counting rows for %s: %v\n", name, err)
			meta.Records = 0
		}

		var colCount int
		err = database.DB.QueryRow(
			`SELECT COUNT(*) FROM information_schema.columns
			 WHERE table_schema='public' AND table_name=$1`, name,
		).Scan(&colCount)
		if err != nil {
			fmt.Printf("Error counting columns for %s: %v\n", name, err)
			colCount = 0
		}
		meta.Columns = colCount

		var sizeBytes int64
		err = database.DB.QueryRow(`
    SELECT COALESCE(SUM(pg_total_relation_size(schemaname||'.'||tablename)), 0)
    FROM pg_tables
    WHERE tablename = $1 AND schemaname = 'public'
`, name).Scan(&sizeBytes)
		if err != nil {
			fmt.Printf("Error getting size for %s: %v\n", name, err)
			sizeBytes = 0
		}
		meta.Size = formatSize(sizeBytes)

		// Дата створення (з системного часу)
		meta.Created = time.Now().Format("2006-01-02")

		fmt.Printf("Loaded table: %s (Records: %d, Columns: %d, Size: %s)\n", name, meta.Records, meta.Columns, meta.Size)

		tables = append(tables, meta)
	}
	return tables, nil
}

// formatSize конвертує байти в читаємий формат (KB, MB, GB)
func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%d B", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %s", float64(bytes)/float64(div), []string{"B", "KB", "MB", "GB"}[exp])
}

// DropTable видаляє таблицю
func DropTable(tableName string) error {
	if err := ValidateIdentifier(tableName); err != nil {
		return fmt.Errorf("invalid table name: %w", err)
	}
	_, err := database.DB.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %q", tableName))
	return err
}

// PreviewTable повертає перші n рядків таблиці
func PreviewTable(tableName string, n int) ([]map[string]interface{}, error) {
	if err := ValidateIdentifier(tableName); err != nil {
		return nil, fmt.Errorf("invalid table name: %w", err)
	}
	if n <= 0 || n > 100 {
		n = 10
	}
	rows, err := database.DB.Query(fmt.Sprintf("SELECT * FROM %q LIMIT %d", tableName, n))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	cols, _ := rows.Columns()
	var result []map[string]interface{}
	for rows.Next() {
		vals := make([]interface{}, len(cols))
		ptrs := make([]interface{}, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			continue
		}
		row := make(map[string]interface{})
		for i, c := range cols {
			row[c] = vals[i]
		}
		result = append(result, row)
	}
	return result, nil
}

// FindDuplicates шукає повністю дублікати рядків у таблиці
func FindDuplicates(tableName string) (int, []map[string]interface{}, error) {
	if err := ValidateIdentifier(tableName); err != nil {
		return 0, nil, err
	}

	colRows, err := database.DB.Query(
		`SELECT column_name FROM information_schema.columns
		 WHERE table_schema='public' AND table_name=$1
		 ORDER BY ordinal_position`, tableName,
	)
	if err != nil {
		return 0, nil, err
	}
	var cols []string
	for colRows.Next() {
		var c string
		_ = colRows.Scan(&c)
		cols = append(cols, fmt.Sprintf("%q", c))
	}
	colRows.Close()

	if len(cols) == 0 {
		return 0, nil, fmt.Errorf("table has no columns")
	}

	colList := ""
	for i, c := range cols {
		if i > 0 {
			colList += ", "
		}
		colList += c
	}

	q := fmt.Sprintf(
		"SELECT %s, COUNT(*) AS duplicate_count FROM %q GROUP BY %s HAVING COUNT(*) > 1",
		colList, tableName, colList,
	)
	rows, err := database.DB.Query(q)
	if err != nil {
		return 0, nil, err
	}
	defer rows.Close()

	allCols, _ := rows.Columns()
	var dupRows []map[string]interface{}
	total := 0
	for rows.Next() {
		vals := make([]interface{}, len(allCols))
		ptrs := make([]interface{}, len(allCols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		_ = rows.Scan(ptrs...)
		row := make(map[string]interface{})
		for i, c := range allCols {
			row[c] = vals[i]
		}
		dupRows = append(dupRows, row)
		total++
	}
	return total, dupRows, nil
}
