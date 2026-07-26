package helperFunc

import (
	"strconv"
	"strings"
)

func typificationOfData(representationOfData []string) []string {
	typeOfData := make([]string, len(representationOfData))
	for i, v := range representationOfData {
		v = strings.TrimSpace(v)
		if _, err := strconv.ParseFloat(v, 64); err == nil {
			if strings.Contains(v, ".") {
				typeOfData[i] = "NUMERIC"
			} else {
				typeOfData[i] = "INTEGER"
			}
			continue
		}
		typeOfData[i] = "TEXT"
	}
	return typeOfData
}

func InferColumnTypes(records [][]string) []string {
	if len(records) == 0 {
		return nil
	}
	numCols := len(records[0])
	// Починаємо з припущення що всі числові
	isFloat := make([]bool, numCols)
	isInt := make([]bool, numCols)
	for i := range isFloat {
		isFloat[i] = true
		isInt[i] = true
	}

	for _, row := range records {
		for i := 0; i < numCols && i < len(row); i++ {
			v := strings.TrimSpace(row[i])
			if v == "" {
				continue
			}
			if _, err := strconv.ParseInt(v, 10, 64); err != nil {
				isInt[i] = false
			}
			if _, err := strconv.ParseFloat(v, 64); err != nil {
				isFloat[i] = false
				isInt[i] = false
			}
		}
	}

	types := make([]string, numCols)
	for i := range types {
		switch {
		case isInt[i]:
			types[i] = "BIGINT"
		case isFloat[i]:
			types[i] = "NUMERIC"
		default:
			types[i] = "TEXT"
		}
	}
	return types
}
